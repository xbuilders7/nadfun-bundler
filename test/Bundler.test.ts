import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Bundler", function () {
  const TOKEN_NAME = "Xbuilders7 Token";
  const TOKEN_SYMBOL = "XBD7";
  const TOKEN_URI = "ipfs://bafkreif2wh4t4ijxnt3dkx3w7j5n2b3evg6ksd4vth5py6ef4ohr7hgl3i";

  async function deployCore() {
    const [deployer, creator, buyer] = await ethers.getSigners();

    const WNative = await ethers.getContractFactory("MockWNative");
    const wNative = await WNative.deploy();

    const FeeVault = await ethers.getContractFactory("MockFeeVault");
    const vault = await FeeVault.deploy(await wNative.getAddress());

    const Factory = await ethers.getContractFactory("MockBondingCurveFactory");
    const factory = await Factory.deploy(await wNative.getAddress());

    const Bundler = await ethers.getContractFactory("Bundler");
    const bundler = await Bundler.deploy(await wNative.getAddress(), await vault.getAddress());

    await bundler.initialize(await factory.getAddress());

    return { deployer, creator, buyer, wNative, vault, factory, bundler };
  }

  async function createCurve(
    bundler: any,
    creator: any,
    factory: any,
    amountIn: bigint,
    fee: bigint
  ) {
    const deployFee = await factory.deployFee();
    const totalValue = amountIn + fee + deployFee;

    const args = [
      creator.address,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_URI,
      amountIn,
      fee,
    ] as const;

    const preview = await bundler.createCurve.staticCall(...args, { value: totalValue });

    await bundler.createCurve(...args, { value: totalValue });

    return { preview, deployFee };
  }

  it("initializes only once", async function () {
    const { bundler, factory } = await deployCore();
    await expect(bundler.initialize(await factory.getAddress())).to.be.revertedWith(
      "Core : ERR_CORE_ALREADY_INITIALIZED"
    );
  });

  it("creates a curve and routes funds correctly", async function () {
    const { bundler, creator, factory, wNative, vault } = await deployCore();
    const amountIn = ethers.parseEther("1");
    const fee = ethers.parseEther("0.05");

    const { preview, deployFee } = await createCurve(bundler, creator, factory, amountIn, fee);

    const curve = preview[0];
    const tokenAddress = preview[1];
    const amountOut = preview[4];

    const token = await ethers.getContractAt("MockToken", tokenAddress);
    const vaultAddress = await vault.getAddress();

    expect(await token.balanceOf(creator.address)).to.equal(amountOut);
    expect(await wNative.balanceOf(curve)).to.equal(amountIn);
    expect(await wNative.balanceOf(vaultAddress)).to.equal(fee + deployFee);
  });

  it("buys tokens and forwards the fee to the vault", async function () {
    const { bundler, creator, buyer, factory, wNative, vault } = await deployCore();
    const creationAmountIn = ethers.parseEther("1");
    const creationFee = ethers.parseEther("0.05");

    const { preview, deployFee } = await createCurve(
      bundler,
      creator,
      factory,
      creationAmountIn,
      creationFee
    );

    const tokenAddress = preview[1];
    const curveAddress = preview[0];

    const token = await ethers.getContractAt("MockToken", tokenAddress);
    const curve = await ethers.getContractAt("MockBondingCurve", curveAddress);

    const buyAmountIn = ethers.parseEther("0.5");
    const buyFee = ethers.parseEther("0.01");
    const totalValue = buyAmountIn + buyFee;
    const deadline = (await time.latest()) + 3600;

    const [virtualNative, virtualToken] = await curve.getVirtualReserves();
    const k = await curve.getK();
    const expectedOut = await bundler.getAmountOut(buyAmountIn, k, virtualNative, virtualToken);

    const vaultAddress = await vault.getAddress();
    const previousVaultBalance = await wNative.balanceOf(vaultAddress);
    const previousCurveBalance = await wNative.balanceOf(curveAddress);

    await expect(
      bundler
        .connect(buyer)
        .buy(buyAmountIn, buyFee, tokenAddress, buyer.address, deadline, { value: totalValue })
    ).to.emit(bundler, "NadFunBuy");

    expect(await token.balanceOf(buyer.address)).to.equal(expectedOut);
    expect(await wNative.balanceOf(curveAddress)).to.equal(previousCurveBalance + buyAmountIn);
    expect(await wNative.balanceOf(vaultAddress)).to.equal(previousVaultBalance + buyFee);
    expect(await wNative.balanceOf(vaultAddress)).to.equal(creationFee + deployFee + buyFee);
  });

  it("sells tokens and transfers native proceeds after fees", async function () {
    const { bundler, creator, buyer, factory, wNative, vault } = await deployCore();

    const creationAmountIn = ethers.parseEther("2");
    const creationFee = ethers.parseEther("0.1");

    const { preview, deployFee } = await createCurve(
      bundler,
      creator,
      factory,
      creationAmountIn,
      creationFee
    );

    const tokenAddress = preview[1];
    const curveAddress = preview[0];

    const token = await ethers.getContractAt("MockToken", tokenAddress);
    const curve = await ethers.getContractAt("MockBondingCurve", curveAddress);

    const buyAmountIn = ethers.parseEther("0.5");
    const buyFee = ethers.parseEther("0.01");
    const totalValue = buyAmountIn + buyFee;
    let deadline = (await time.latest()) + 3600;

    await bundler
      .connect(buyer)
      .buy(buyAmountIn, buyFee, tokenAddress, buyer.address, deadline, { value: totalValue });

    const buyerBalance = await token.balanceOf(buyer.address);
    const sellAmount = buyerBalance / 2n;
    const bundlerAddress = await bundler.getAddress();
    await token.connect(buyer).approve(bundlerAddress, sellAmount);

    const [virtualNative, virtualToken] = await curve.getVirtualReserves();
    const k = await curve.getK();
    const expectedNativeOut = await bundler.getAmountOut(sellAmount, k, virtualToken, virtualNative);
    const [feeDenominator, feeNumerator] = await curve.getFeeConfig();
    const expectedFee = (expectedNativeOut * BigInt(feeDenominator)) / BigInt(feeNumerator);
    const vaultAddress = await vault.getAddress();
    const previousVaultBalance = await wNative.balanceOf(vaultAddress);

    deadline = (await time.latest()) + 3600;

    await expect(() =>
      bundler.connect(buyer).sell(sellAmount, tokenAddress, buyer.address, deadline)
    ).to.changeEtherBalance(buyer, expectedNativeOut - expectedFee);

    expect(await wNative.balanceOf(vaultAddress)).to.equal(
      previousVaultBalance + expectedFee
    );

    expect(await wNative.balanceOf(vaultAddress)).to.equal(
      creationFee + deployFee + buyFee + expectedFee
    );
  });
});


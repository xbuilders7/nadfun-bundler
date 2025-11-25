import { ethers } from "ethers";
import bundlerAbi from "../artifacts/contracts/Bundler.sol/Bundler.json";
import factoryAbi from "../artifacts/contracts/interfaces/IBondingCurveFactory.sol/IBondingCurveFactory.json";

type ArgMap = Record<string, string>;

function parseArgs(): ArgMap {
    return process.argv.slice(2).reduce<ArgMap>((acc, curr) => {
        const [flag, value] = curr.split("=");
        if (!flag.startsWith("--")) {
            return acc;
        }
        acc[flag.slice(2)] = value ?? "";
        return acc;
    }, {});
}

function requireArg(args: ArgMap, key: string, fallback?: string): string {
    const value = args[key] ?? fallback;
    if (!value) {
        throw new Error(`Missing required argument --${key}`);
    }
    return value;
}

async function main() {
    const args = parseArgs();

    const rpcUrl = requireArg(args, "rpcUrl", process.env.RPC_URL);
    const privateKey = requireArg(args, "privateKey", process.env.PRIVATE_KEY);
    const bundlerAddress = requireArg(args, "bundler", process.env.BUNDLER_ADDRESS);
    const creator = requireArg(args, "creator");
    const name = requireArg(args, "name");
    const symbol = requireArg(args, "symbol");
    const tokenURI = requireArg(args, "tokenURI");
    const amountIn = ethers.parseUnits(requireArg(args, "amountIn"), args.amountInDecimals ?? "18");
    const fee = ethers.parseUnits(requireArg(args, "fee"), args.feeDecimals ?? "18");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const bundler = new ethers.Contract(bundlerAddress, bundlerAbi.abi, wallet);

    const factoryAddress: string = await bundler.factory();
    const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, wallet);

    const deployFee: bigint = await factory.getDelpyFee();
    const totalValue = amountIn + fee + deployFee;

    const staticResult = await bundler.createCurve.staticCall(
        creator,
        name,
        symbol,
        tokenURI,
        amountIn,
        fee,
        { value: totalValue }
    );

    const tx = await bundler.createCurve(creator, name, symbol, tokenURI, amountIn, fee, { value: totalValue });
    console.log(`Submitted tx ${tx.hash}, waiting for confirmation...`);
    const receipt = await tx.wait();

    console.log(`Tx confirmed in block ${receipt?.blockNumber}`);
    console.log(`Curve address: ${staticResult[0]}`);
    console.log(`Token address: ${staticResult[1]}`);
    console.log(`Virtual Native after buy: ${ethers.formatEther(staticResult[2])}`);
    console.log(`Virtual Token after buy: ${ethers.formatEther(staticResult[3])}`);
    console.log(`Amount out (tokens received): ${ethers.formatEther(staticResult[4])}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});


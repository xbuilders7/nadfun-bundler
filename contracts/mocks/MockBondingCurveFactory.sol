// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MockBondingCurve} from "contracts/mocks/MockBondingCurve.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

contract MockBondingCurveFactory {
    struct CurveInfo {
        address curve;
        address token;
    }

    address public immutable wNative;
    uint256 public deployFee = 0.01 ether;
    uint256 public listingFee;
    uint256 public tokenTotalSupply = 1_000_000 ether;
    uint256 public virtualNative = 10 ether;
    uint256 public virtualToken = 1_000 ether;
    uint256 public targetToken = 100_000 ether;
    uint16 public feeNumerator = 100;
    uint8 public feeDenominator = 1;

    mapping(address => address) public curveByToken;
    CurveInfo[] public curves;

    event MockCurveCreated(address indexed token, address indexed curve);

    constructor(address _wNative) {
        wNative = _wNative;
    }

    function setDeployFee(uint256 newDeployFee) external {
        deployFee = newDeployFee;
    }

    function setVirtualReserves(uint256 nativeReserve, uint256 tokenReserve) external {
        virtualNative = nativeReserve;
        virtualToken = tokenReserve;
    }

    function setFeeConfig(uint8 denominator, uint16 numerator) external {
        feeDenominator = denominator;
        feeNumerator = numerator;
    }

    function create(address, string memory name, string memory symbol, string memory)
        external
        returns (address curve, address token, uint256 virtualNativeOut, uint256 virtualTokenOut)
    {
        MockToken newToken = new MockToken(name, symbol);
        MockBondingCurve newCurve = new MockBondingCurve(
            address(newToken),
            wNative,
            feeDenominator,
            feeNumerator,
            virtualNative,
            virtualToken,
            targetToken
        );

        newToken.setMinter(address(newCurve));

        curve = address(newCurve);
        token = address(newToken);
        virtualNativeOut = virtualNative;
        virtualTokenOut = virtualToken;

        curveByToken[token] = curve;
        curves.push(CurveInfo({curve: curve, token: token}));

        emit MockCurveCreated(token, curve);
    }

    function getCurve(address token) external view returns (address curve) {
        curve = curveByToken[token];
    }

    function getDelpyFee() external view returns (uint256) {
        return deployFee;
    }
}


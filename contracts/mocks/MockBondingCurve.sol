// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

contract MockBondingCurve {
    address public immutable token;
    address public immutable wNative;

    uint8 private feeDenominator;
    uint16 private feeNumerator;
    uint256 private virtualNative;
    uint256 private virtualToken;
    uint256 private k;
    uint256 private targetToken;

    constructor(
        address _token,
        address _wNative,
        uint8 _feeDenominator,
        uint16 _feeNumerator,
        uint256 _virtualNative,
        uint256 _virtualToken,
        uint256 _targetToken
    ) {
        token = _token;
        wNative = _wNative;
        feeDenominator = _feeDenominator;
        feeNumerator = _feeNumerator;
        virtualNative = _virtualNative;
        virtualToken = _virtualToken;
        k = _virtualNative * _virtualToken;
        targetToken = _targetToken;
    }

    function buy(address, uint256 amountOut) external {
        MockToken(token).mint(msg.sender, amountOut);
    }

    function sell(address, uint256 amountOut) external {
        IERC20(wNative).transfer(msg.sender, amountOut);
    }

    function setVirtualReserves(uint256 nativeReserve, uint256 tokenReserve) external {
        virtualNative = nativeReserve;
        virtualToken = tokenReserve;
        k = nativeReserve * tokenReserve;
    }

    function getFeeConfig() external view returns (uint8, uint16) {
        return (feeDenominator, feeNumerator);
    }

    function getVirtualReserves() external view returns (uint256, uint256) {
        return (virtualNative, virtualToken);
    }

    function getK() external view returns (uint256) {
        return k;
    }

    function getTargetToken() external view returns (uint256) {
        return targetToken;
    }

    function getLock() external pure returns (bool) {
        return false;
    }

    function getIsListing() external pure returns (bool) {
        return false;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (virtualNative, virtualToken);
    }

    function listing() external pure returns (address) {
        return address(0);
    }

    function initialize(
        address,
        uint256,
        uint256,
        uint256 _k,
        uint256 _targetNative,
        uint8 _feeDenominator,
        uint16 _feeNumerator
    ) external {
        k = _k;
        targetToken = _targetNative;
        feeDenominator = _feeDenominator;
        feeNumerator = _feeNumerator;
    }
}


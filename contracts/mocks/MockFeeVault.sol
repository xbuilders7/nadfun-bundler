// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFeeVault} from "contracts/interfaces/IFeeVault.sol";

contract MockFeeVault is IFeeVault {
    address public immutable wNative;

    constructor(address _wNative) {
        wNative = _wNative;
    }

    function totalAssets() external view override returns (uint256) {
        return IERC20(wNative).balanceOf(address(this));
    }

    function proposeWithdrawal(address, uint256) external pure override {}

    function signWithdrawal(uint256) external pure override {}
}


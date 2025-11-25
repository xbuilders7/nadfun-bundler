// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IWNative} from "contracts/interfaces/IWNative.sol";

contract MockWNative is ERC20, IWNative {
    constructor() ERC20("Mock Wrapped Native", "mWNATIVE") {}

    function deposit() public payable override {
        require(msg.value > 0, "MockWNative: zero deposit");
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public override {
        _burn(msg.sender, amount);
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "MockWNative: withdraw failed");
        emit Withdrawal(msg.sender, amount);
    }

    receive() external payable {
        deposit();
    }
}


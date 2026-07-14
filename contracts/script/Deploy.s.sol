// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Salvo} from "../src/Salvo.sol";

/// Usage:
///   TREASURY=0x... forge script script/Deploy.s.sol \
///     --rpc-url $ROBINHOOD_RPC --private-key $DEPLOYER_KEY --broadcast
contract Deploy is Script {
    function run() external returns (Salvo salvo) {
        vm.startBroadcast();
        salvo = new Salvo(vm.envAddress("TREASURY"));
        vm.stopBroadcast();
    }
}

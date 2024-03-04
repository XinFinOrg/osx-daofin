// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

contract MockTimestampOracle {
    using SafeCastUpgradeable for uint256;

    function getUint64Timestamp() public view returns (uint64) {
        return block.timestamp.toUint64();
    }
}

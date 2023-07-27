// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IXDCValidator {
    function isCandidate(address _candidate) external view returns (bool);
}

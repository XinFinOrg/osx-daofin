// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract XDCValidator {
    mapping(address => bool) validators;

    function addCandidate(address candidate) external {
        validators[candidate] = true;
    }

    function removeCandidate(address candidate) external {
        delete validators[candidate];
    }

    function isCandidate(address _candidate) external view returns (bool) {
        return validators[_candidate];
    }
}

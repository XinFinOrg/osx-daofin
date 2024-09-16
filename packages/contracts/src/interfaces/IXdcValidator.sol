// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IXDCValidator {
    function isCandidate(address _candidate) external view returns (bool);

    function getCandidates() external view returns (address[] memory);

    function owners(uint256 _index) external view returns (address);

    function getOwnerCount() external view returns (uint256);

    function getCandidateOwner(address _candidate) external view returns (address);

    function candidates() external view returns (address[] memory);

    function candidateCount() external view returns (uint256);
}

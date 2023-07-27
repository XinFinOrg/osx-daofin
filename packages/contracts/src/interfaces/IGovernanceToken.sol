// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IGovernanceToken {
    function mint(address to, uint256 amount) external;

    function burn(address to, uint256 amount) external;

    function transferFrom(address from, address to, uint256 amount) external;
}

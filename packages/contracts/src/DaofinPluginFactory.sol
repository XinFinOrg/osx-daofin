// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {DAO} from "@xinfin/osx/core/dao/DAO.sol";
import {PluginSetup, IPluginSetup} from "@xinfin/osx/framework/plugin/setup/PluginSetup.sol";
import {PermissionLib} from "@xinfin/osx/core/permission/PermissionLib.sol";
import {DaofinPlugin} from "./DaofinPlugin.sol";
import {BaseDaofinPlugin} from "./Base/BaseDaofinPlugin.sol";
import {createERC1967Proxy as createERC1967} from "@xinfin/osx/utils/Proxy.sol";

contract DaofinPluginFactory {
    DaofinPlugin private immutable daofinPluginBase;

    constructor() {
        daofinPluginBase = new DaofinPlugin();
    }

    event Deployed(address dao, address plugin);

    function prepareInstallation(
        address _dao,
        bytes calldata _data
    ) external returns (address dao, address plugin) {
        // Decode _data
        (
            uint256 allowedAmount,
            address xdcValidator,
            BaseDaofinPlugin.CommitteeVotingSettings[] memory committeeVotingSettings,
            BaseDaofinPlugin.CommitteeVotingSettings[] memory generalCommitteeVotingSettings,
            uint64[] memory electionPeriods,
            address[] memory judiciaries,
            uint256 proposalCosts
        ) = abi.decode(
                _data,
                (
                    uint256,
                    address,
                    BaseDaofinPlugin.CommitteeVotingSettings[],
                    BaseDaofinPlugin.CommitteeVotingSettings[],
                    uint64[],
                    address[],
                    uint256
                )
            );
        // Deploy plugin proxy
        plugin = createERC1967Proxy(
            address(daofinPluginBase),
            abi.encodeWithSelector(
                DaofinPlugin.initialize.selector,
                _dao,
                allowedAmount,
                xdcValidator,
                committeeVotingSettings,
                generalCommitteeVotingSettings,
                electionPeriods,
                judiciaries,
                proposalCosts
            )
        );
        emit Deployed(_dao, plugin);
        return (_dao, plugin);
    }

    function createERC1967Proxy(
        address _implementation,
        bytes memory _data
    ) internal returns (address) {
        return createERC1967(_implementation, _data);
    }

    function implementation() external view returns (address) {
        return address(daofinPluginBase);
    }
}

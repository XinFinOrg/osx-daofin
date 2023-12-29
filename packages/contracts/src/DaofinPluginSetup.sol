// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {DAO} from "@xinfin/osx/core/dao/DAO.sol";
import {PluginSetup, IPluginSetup} from "@xinfin/osx/framework/plugin/setup/PluginSetup.sol";
import {PermissionLib} from "@xinfin/osx/core/permission/PermissionLib.sol";
import {DaofinPlugin} from "./DaofinPlugin.sol";
import "hardhat/console.sol";

contract DaofinPluginSetup is PluginSetup {
    DaofinPlugin private immutable daofinPluginBase;

    constructor() {
        daofinPluginBase = new DaofinPlugin();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    ) external override returns (address plugin, PreparedSetupData memory preparedSetupData) {
        // Decode _data
        (
            uint256[] memory allowedAmounts,
            address xdcValidator,
            DaofinPlugin.CommitteeVotingSettings[] memory committeeVotingSettings,
            DaofinPlugin.CommitteeVotingSettings[] memory generalCommitteeVotingSettings,
            uint64[] memory electionPeriods,
            address[] memory judiciaries
        ) = abi.decode(
                _data,
                (
                    uint256[],
                    address,
                    DaofinPlugin.CommitteeVotingSettings[],
                    DaofinPlugin.CommitteeVotingSettings[],
                    uint64[],
                    address[]
                )
            );
        // Deploy plugin proxy
        plugin = createERC1967Proxy(
            address(daofinPluginBase),
            abi.encodeWithSelector(
                DaofinPlugin.initialize.selector,
                _dao,
                allowedAmounts,
                xdcValidator,
                committeeVotingSettings,
                generalCommitteeVotingSettings,
                electionPeriods,
                judiciaries
            )
        );
        // Prepare and set the needed permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](7);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_JUDICIARY_MAPPING_PERMISSION()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_ELECTION_PERIOD_PERMISSION()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION()
        );

        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEES_LIST_PERMISSION()
        );

        permissions[4] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION()
        );

        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[5] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );

        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[6] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.CREATE_PROPOSAL_TYPE_PERMISSION()
        );

        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        address plugin = _payload.plugin;

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_JUDICIARY_MAPPING_PERMISSION()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_ELECTION_PERIOD_PERMISSION()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION()
        );

        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEES_LIST_PERMISSION()
        );

        permissions[4] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION()
        );

        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[5] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );

        permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(daofinPluginBase);
    }
}

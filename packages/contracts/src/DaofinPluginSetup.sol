// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {PluginSetup, IPluginSetup} from "@xinfin/osx/framework/plugin/setup/PluginSetup.sol";
import {PermissionLib} from "@xinfin/osx/core/permission/PermissionLib.sol";
import {DaofinPlugin} from "./DaofinPlugin.sol";

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
            DaofinPlugin.DaofinVotingSettings memory daofinVotingSettings,
            DaofinPlugin.CommitteeVotingSettings[] memory committeeVotingSettings,
            DaofinPlugin.ElectionPeriod[] memory electionPeriods
        ) = abi.decode(
                _data,
                (
                    DaofinPlugin.DaofinVotingSettings,
                    DaofinPlugin.CommitteeVotingSettings[],
                    DaofinPlugin.ElectionPeriod[]
                )
            );
        // Deploy plugin proxy
        plugin = createERC1967Proxy(
            address(daofinPluginBase),
            abi.encodeWithSelector(
                DaofinPlugin.initialize.selector,
                _dao,
                daofinVotingSettings,
                committeeVotingSettings,
                electionPeriods
            )
        );
        // Prepare and set the needed permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](4);

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

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEES_LIST_PERMISSION()
        );

        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION()
        );
        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        // revoke all of the permissions
        (
            DaofinPlugin.DaofinVotingSettings memory daofinVotingSettings,
            DaofinPlugin.CommitteeVotingSettings[] memory committeeVotingSettings,
            DaofinPlugin.ElectionPeriod[] memory electionPeriods
        ) = abi.decode(
                _payload.data,
                (
                    DaofinPlugin.DaofinVotingSettings,
                    DaofinPlugin.CommitteeVotingSettings[],
                    DaofinPlugin.ElectionPeriod[]
                )
            );
        // Prepare and set the needed permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](4);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_JUDICIARY_MAPPING_PERMISSION()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_ELECTION_PERIOD_PERMISSION()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_COMMITTEES_LIST_PERMISSION()
        );

        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION()
        );
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(daofinPluginBase);
    }
}

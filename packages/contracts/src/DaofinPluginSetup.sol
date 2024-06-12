// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {DAO} from "@xinfin/osx/core/dao/DAO.sol";
import {PluginSetup, IPluginSetup} from "@xinfin/osx/framework/plugin/setup/PluginSetup.sol";
import {PermissionLib} from "@xinfin/osx/core/permission/PermissionLib.sol";
import {DaofinPlugin} from "./DaofinPlugin.sol";
import {BaseDaofinPlugin} from "./Base/BaseDaofinPlugin.sol";

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
            uint256 allowedAmount,
            address xdcValidator,
            BaseDaofinPlugin.CommitteeVotingSettings[] memory committeeVotingSettings,
            BaseDaofinPlugin.CommitteeVotingSettings[] memory generalCommitteeVotingSettings,
            BaseDaofinPlugin.CommitteeVotingSettings[] memory onlyJuryCommitteeVotingSettings,
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
                onlyJuryCommitteeVotingSettings,
                electionPeriods,
                judiciaries,
                proposalCosts
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
            daofinPluginBase.UPDATE_MIN_HOUSE_AMOUNT_PERMISSION()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_JUDICIARY_MAPPING_PERMISSION()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.CREATE_PROPOSAL_TYPE_PERMISSION()
        );

        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_PROPOSAL_COSTS_PERMISSION()
        );

        permissions[4] = PermissionLib.MultiTargetPermission({
            operation: PermissionLib.Operation.Grant,
            where: plugin,
            who: _dao,
            condition: PermissionLib.NO_CONDITION,
            permissionId: daofinPluginBase.UPDATE_ELECTION_PERIOD_PERMISSION()
        });
        permissions[5] = PermissionLib.MultiTargetPermission({
            operation: PermissionLib.Operation.Grant,
            where: plugin,
            who: _dao,
            condition: PermissionLib.NO_CONDITION,
            permissionId: daofinPluginBase.MODIFY_PROPOSAL_TYPE_PERMISSION()
        });
        // DAO.sol Permissions
        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[6] = PermissionLib.MultiTargetPermission({
            operation: PermissionLib.Operation.Grant,
            where: _dao,
            who: plugin,
            condition: PermissionLib.NO_CONDITION,
            permissionId: DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        });

        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        address plugin = _payload.plugin;

        // Prepare and set the needed permissions
        permissions = new PermissionLib.MultiTargetPermission[](7);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.UPDATE_MIN_HOUSE_AMOUNT_PERMISSION()
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
            daofinPluginBase.UPDATE_JUDICIARY_MAPPING_PERMISSION()
        );
        permissions[3] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            daofinPluginBase.CREATE_PROPOSAL_TYPE_PERMISSION()
        );

        permissions[4] = PermissionLib.MultiTargetPermission({
            operation: PermissionLib.Operation.Revoke,
            where: plugin,
            who: _dao,
            condition: PermissionLib.NO_CONDITION,
            permissionId: daofinPluginBase.UPDATE_PROPOSAL_COSTS_PERMISSION()
        });
        permissions[5] = PermissionLib.MultiTargetPermission({
            operation: PermissionLib.Operation.Revoke,
            where: plugin,
            who: _dao,
            condition: PermissionLib.NO_CONDITION,
            permissionId: daofinPluginBase.MODIFY_PROPOSAL_TYPE_PERMISSION()
        });
        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[6] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(daofinPluginBase);
    }
}

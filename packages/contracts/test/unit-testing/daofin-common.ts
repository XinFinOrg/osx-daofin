import {ethers} from 'hardhat';

export const abiCoder = ethers.utils.defaultAbiCoder;
export const EMPTY_DATA = '0x';

export const STORE_PERMISSION_ID = ethers.utils.id('STORE_PERMISSION');

export const UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION_ID = ethers.utils.id(
  'UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION'
);
export const UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION_ID = ethers.utils.id(
  'UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION'
);
export const UPDATE_ELECTION_PERIOD_PERMISSION_ID = ethers.utils.id(
  'UPDATE_ELECTION_PERIOD_PERMISSION'
);
export const UPDATE_COMMITTEES_LIST_PERMISSION_ID = ethers.utils.id(
  'UPDATE_COMMITTEES_LIST_PERMISSION'
);
export const UPDATE_JUDICIARY_MAPPING_PERMISSION_ID = ethers.utils.id(
  'UPDATE_JUDICIARY_MAPPING_PERMISSION'
);
export const EXECUTE_PERMISSION_ID = ethers.utils.id('EXECUTE_PERMISSION');

export const MasterNodeCommittee = ethers.utils.id('MASTER_NODE_COMMITTEE');
export const PeoplesHouseCommittee = ethers.utils.id('PEOPLES_HOUSE_COMMITTEE');
export const JudiciaryCommittee = ethers.utils.id('JUDICIARY_COMMITTEE');

export const ADDRESS_ZERO = ethers.constants.AddressZero;
export const ADDRESS_ONE = `0x${'0'.repeat(39)}1`;
export const ADDRESS_TWO = `0x${'0'.repeat(39)}2`;
export const NO_CONDITION = ADDRESS_ZERO;

export const XdcValidator = '0x33d5e357b66d41F059777E9086245a878697458f';

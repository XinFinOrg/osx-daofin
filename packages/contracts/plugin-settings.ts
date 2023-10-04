import daofinBuildMetadata from './src/build-metadata.json';
import daofinReleaseMetadata from './src/release-metadata.json';

export const DaofinPluginSetupParams: PluginSetupParams = {
  PLUGIN_REPO_ENS_NAME: 'beny-plugin-repo-10014',
  PLUGIN_CONTRACT_NAME: 'DaofinPlugin',
  PLUGIN_SETUP_CONTRACT_NAME: 'DaofinPluginSetup',
  VERSION: {
    release: 1, // Increment this number ONLY if breaking/incompatible changes were made. Updates between releases are NOT possible.
    build: 1, // Increment this number if non-breaking/compatible changes were made. Updates to newer builds are possible.
  },
  METADATA: {
    build: daofinBuildMetadata,
    release: daofinReleaseMetadata,
  },
};

// Types

export type PluginSetupParams = {
  PLUGIN_REPO_ENS_NAME: string;
  PLUGIN_CONTRACT_NAME: string;
  PLUGIN_SETUP_CONTRACT_NAME: string;
  VERSION: {
    release: number;
    build: number;
  };
  METADATA: {
    build: {[k: string]: any};
    release: {[k: string]: any};
  };
};

import { DaofinClient } from './client';
import {
  DaofinContextParams,
  DaofinContextState,
  DaofinOverriddenState,
} from './types';
import { ContextCore, ContextState } from '@xinfin/osx-client-common';
import { Context } from '@xinfin/osx-sdk-client';

export class DaofinPluginContext extends ContextCore {
  // super is called before the properties are initialized
  // so we initialize them to the value of the parent class
  protected state: ContextState = this.state;
  private daofinState: DaofinContextState = {
    pluginAddress: '',
    pluginRepoAddress: '',
  };
  // TODO
  // fix typo in the overridden property name
  protected overriden: DaofinOverriddenState = this.overriden;
  constructor(contextParams?: DaofinContextParams, aragonContext?: Context) {
    // call the parent constructor
    // so it does not complain and we
    // can use this
    super();
    // set the context params inherited from the context
    if (aragonContext) {
      // copy the context properties to this
      Object.assign(this, aragonContext);
    }
    // contextParams have priority over the aragonContext
    if (contextParams) {
      // overide the context params with the ones passed to the constructor
      this.set(contextParams);
    }
  }

  public set(contextParams: DaofinContextParams) {
    // the super function will call this set
    // so we need to call the parent set first
    super.set(contextParams);
    // set the default values for the new params
    this.setDefaults();

    // override default params if specified in the context
    if (contextParams.pluginAddress) {
      // override the myPluginPluginAddress value
      this.daofinState.pluginAddress = contextParams.pluginAddress;
      // set the overriden flag to true in case set is called again
      //   this.overriden.pluginAddress = true;
    }

    if (contextParams.pluginRepoAddress) {
      this.daofinState.pluginRepoAddress = contextParams.pluginRepoAddress;
      //   this.overriden.pluginRepoAddress = true;
    }
  }

  private setDefaults() {
    if (!this.overriden.pluginAddress) {
    }
    if (!this.overriden.pluginRepoAddress) {
      // this.state.pluginAddress = DEFAULT_SIMPLE_STORAGE_Repo_ADDRESS;
    }
  }

  get pluginAddress(): string {
    return this.daofinState.pluginAddress;
  }

  get pluginRepoAddress(): string {
    return this.daofinState.pluginRepoAddress;
  }
}

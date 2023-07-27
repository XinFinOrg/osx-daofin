export interface IDaofinClientMethods{}
export interface IDaofinClientEncoding{}
export interface IDaofinClientDecoding{}
export interface IDaofinClientEstimation{}

export interface IDaofinClient {
    methods: IDaofinClientMethods;
    encoding: IDaofinClientEncoding;
    decoding: IDaofinClientDecoding;
    estimation: IDaofinClientEstimation;
  }
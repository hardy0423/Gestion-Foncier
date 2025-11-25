import { CustomField } from "./type";

export interface LayerField {
    nillable: string;
    name: string;
    type: string;
    color?: string;
}

export interface SaveFields{
    map:string,
    layer:string,
    fields:FieldData[]
}

export interface RemoveField {
    map:string,
    layer:string,
    field_name:string
}

export interface FieldData{
    name:string,
    alias:string,
    data_type:string,
    choices?:string[]
}

export interface FieldIsMany{
    isMany:boolean,
    values:string[]
}

export interface FieldProperty{
    field:CustomField,
    prop:FieldIsMany
}
import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { FieldData } from 'src/app/data/models/layer-field';
import { tap } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-field',
  templateUrl: './field.component.html',
  styleUrls: ['./field.component.scss']
})
export class FieldComponent implements OnInit {

  @Input() index:number
  @Output() delete: EventEmitter<void>=new EventEmitter<void>()
  validityChanges:EventEmitter<boolean>=new EventEmitter<boolean>()
  
  name:string
  alias:string
  type:string
  isValid:boolean=false
  isNameValid:boolean=false
  isDataTypeValid:boolean=false
  isMultipleChoices:boolean=false
  isDisplayChoices:boolean=false
  isChoicesValid:boolean=false
  names:string[]


  choicesForm:FormGroup=new FormGroup({})
  inputs:string[] = []

  constructor(private fb:FormBuilder) {
    this.choicesForm=this.fb.group({ })
   }

  ngOnInit(): void {
    
  }

  getData():FieldData{
    const data:FieldData = {
      name:this.name.replace(/ /g,"_"),
      alias: this.alias,
      data_type: this.type
    }
    if(this.isMultipleChoices){
      data.choices = this.inputs.map(input=>{
        const control = this.choicesForm.get(input)
        return control.value
      })
    }
    return data
  }
  onNameChange(newValue:string){
    if(newValue==""){
      this.isNameValid=false
    }
    else {
      const check = this.checkNameIfNotExists(newValue)
      this.isNameValid = check
    }
    this.checkValidity()
  }

  checkNameIfNotExists(name:string){
    const checkIf=this.names.filter(n=> n.toLowerCase() == name.replace(/ /g,'_').toLowerCase())
    return checkIf.length == 0
  }

  onDataTypeChange(newValue:string){
    if(newValue=="text" || newValue=="int" || newValue=="double" || newValue == "date"){
      this.isMultipleChoices=false
      this.isDataTypeValid=true
    }
    else if(newValue =="multiplechoices"){
      this.isMultipleChoices=true
      this.isDataTypeValid=true

    }
    else this.isDataTypeValid=false
    this.checkValidity()
  }

  checkValidity(){
    this.isValid = (this.isNameValid && this.isDataTypeValid && !this.isMultipleChoices) 
    || (this.isNameValid && this.isDataTypeValid && this.isMultipleChoices && this.choicesForm.valid && this.inputs.length > 0)

    this.validityChanges.emit(this.isValid)
  }

  removeComponent(){
    this.delete.emit()
  }

  generateShortRandomName(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
  }

  addChoice(){
    this.isDisplayChoices = true
    const name = this.generateShortRandomName(5)
    this.inputs.unshift(name)
    this.choicesForm.addControl(name,new FormControl(''))
    this.choicesForm.valueChanges.pipe(tap(value=>{
      this.checkValidity()
    })).subscribe()

    this.checkValidity()

  }

  removeChoice(name:string){
    this.choicesForm.removeControl(name)
    this.inputs = this.inputs.filter(input=>input != name)

  }

  displayChoices(){
    this.isDisplayChoices= !this.isDisplayChoices
  }

}

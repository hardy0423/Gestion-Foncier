import { Component, ComponentRef, EventEmitter, Input, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { FieldComponent } from '../field/field.component';
import { FieldData, FieldProperty } from 'src/app/data/models/layer-field';
import { FieldService } from 'src/app/data/services/field.service';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { StoreService } from 'src/app/data/store/store.service';
import { User } from 'src/app/data/models/account';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-fields',
  templateUrl: './fields.component.html',
  styleUrls: ['./fields.component.scss']
})
export class FieldsComponent implements OnInit {

  fieldsComponents:ComponentRef<FieldComponent>[]=[]
  loading:boolean=false
  isValid:boolean=false
  events:EventEmitter<boolean>[]
  validValues:{component:FieldComponent,isvalid:boolean}[]=[]
  user:User

  @Input() project:string
  @Input() layer:string
  @Input() providerVectorId:number
  @Input() existingFields:FieldProperty[]

  @ViewChild("dynamicContainer",{read:ViewContainerRef}) dynamicContainer:ViewContainerRef

  constructor(
    private fieldService:FieldService,
    private notifier:NotifierService,
    private store: StoreService, 
    public translate: TranslateService
  ) { 
    this.user=store.user
  }

  ngOnInit(): void {
    
  }

  addField(){
    const component = this.dynamicContainer.createComponent(FieldComponent,{index:0})
    component.instance.names = this.existingFields.map(field=>field.field.name_field)
    this.fieldsComponents.push(component)

    //Réinitialiser la validité des données en false
    this.isValid=false

    //Commencer une écoute des évenements sur validityChanges
    component.instance.validityChanges
    .pipe(tap(value=>{
      //Vérifier si le component est déjà dans la liste
      const check=this.validValues.filter(field=>field.component==component.instance)
      if(check.length == 0){
        this.validValues.push({component:component.instance,isvalid:value})
      }
      else {
        check[0].isvalid=value
      }

      //A chaque changement, vérifier la validité des données
      this.isValid=this.checkIfValid()

    }))
    .subscribe()

    //Supprimer le component à partir d'un event Emmiter
    component.instance.delete.subscribe(_=>{
      //Ne plus écouter le validityChanges
      component.instance.validityChanges.unsubscribe()

      //Supprmier le component de la liste
      this.fieldsComponents = this.fieldsComponents.filter(field=> field !=component)
      this.validValues = this.validValues.filter(value=>value.component != component.instance)

      //Supprimer le component
      component.destroy()

      //Vérifier la validation
      this.isValid = this.checkIfValid()
    })


  }

  checkIfValid():boolean{
    if(this.fieldsComponents.length == 0){
      return false
    }
    const isInvalid = this.validValues.filter(value=>!value.isvalid)
    if(isInvalid.length > 0){
      return false
    }
    return true
  }

  saveFields(){
    this.loading=true
    const data:FieldData[]=this.fieldsComponents.map(field=>field.instance.getData())

    // Check if data does not contain duplicates
    let isValidData = true;
    let validData: Array<string> = []
    for (let i = 0; i < data.length; i++) {
      if (validData.includes(data[i].name.toLowerCase())) {
        this.notifier.notify(
          "error",
          this.translate.instant("layer.list_field.error_loading.existing_fields")
        )
        isValidData = false;
        this.loading=false;
        break;
      } else {
        validData.push(data[i].name.toLowerCase())
      }
    }
    
    // Save fields
    if (isValidData) {
      let query = "MAP=" + this.project +
            "&SERVICE=WFS&VERSION=1.1.0&REQUEST=DescribeFeatureType&TYPENAME=" +
            this.layer
      this.fieldService.saveFields(
        query,
        {
          map:this.project,
          layer:this.layer,
          fields:data
        }
      )
      .pipe(
        catchError((error)=>{
          this.notifier.notify(
            "error",
            this.translate.instant("layer.list_field.error_loading.save_custom_fields")
          )
          this.loading=false
          return EMPTY
        }),
        tap(value=>{
          //Désactiver le loader
          this.loading=false

          //Détruire les fields components
          this.fieldsComponents.forEach(field=>field.destroy())
          this.fieldsComponents=[]
          this.isValid = false;
          this.notifier.notify(
            "success",
            this.translate.instant('layer.list_field.message_save_success')
          )
        })
      )
      .subscribe(()=>this.fieldService.fieldSaved.emit({fields:data, add:true, remove:false}))
    }
  }
}

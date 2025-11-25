import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  concat,
  concatAll,
  concatMap,
  EMPTY,
  filter,
  forkJoin,
  from,
  map,
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs";
import { LayerToDigitalise } from "src/app/data/models/layer-to-digitalise";
import { CustomField, FeatureProperties } from "src/app/data/models/type";
import { FieldService } from "src/app/data/services/field.service";
import { CartoHelper, layersInMap } from "src/app/data/utils/cartoHelper";
import { deleteFeature, updateAttributeFeature } from "src/app/modules/digitaliser/class/featureCrud";
import {
  CircleStyle,
  Feature,
  Fill,
  Geometry,
  Map,
  Stroke,
  Style,
  VectorLayer,
  VectorSource,
} from "src/app/ol-module";
import { ConfirmationDialogComponent } from "src/app/shared/pages/confirmation-dialog/confirmation-dialog.component";
import { Map as MapData} from "maplibre-gl";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import { FieldIsMany, FieldProperty } from "src/app/data/models/layer-field";
import { RightService } from "src/app/data/services/right.service";
import { LayersRight, User } from "src/app/data/models/account";
import { StoreService } from "src/app/data/store/store.service";

@Component({
  selector: "app-features-form",
  templateUrl: "./features-form.component.html",
  styleUrls: ["./features-form.component.scss"],
})
export class FeaturesFormComponent implements OnInit {
  public onInitInstance: () => void;
  public onSubmitInstance: () => void;
  public onDeleteInstance: () => void;
  public onCancelInstance: () => void;
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  feature: Feature<Geometry>;
  layerToDigitalise: LayerToDigitalise;
  close: Subject<boolean>;
  map: Map;
  form: FormGroup = this.fb.group({});
  mapData: MapData;
  loading:boolean=false

  user:User

  private readonly notifier: NotifierService;

  // customFields$: Observable<CustomField[]>;
  customFields$:Observable<FieldProperty[]>
  fields:FieldProperty[]=[]

  userRight$:Observable<boolean>

  constructor(
    public fb: FormBuilder,
    public fieldService: FieldService,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public dialog: MatDialog,
    public geoData: GeoDataService,
    private rightService:RightService,
    private store:StoreService
  ) {
    this.user = store.user

    this.notifier = notifierService;

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    this.customFields$ = onInit.pipe(
      filter(() => this.layerToDigitalise != undefined),
      switchMap(() => {
        this.loading=true
        return this.initField()
      })
    );

    //Raffraichir les champs lorsque des champs ont été sauvegarder
    this.fieldService.fieldSaved
    .pipe(switchMap(()=>{
      this.loading=true
      this.customFields$=undefined
      this.getControlsName().forEach(control=>{
        this.form.removeControl(control,{
          emitEvent:false
        })
      })
      this.form=this.fb.group({})
      this.customFields$ = this.initField()
      return EMPTY
    }))
    .subscribe()

    const onSubmit: Subject<void> = new Subject<void>();
    this.onSubmitInstance = () => {
      onSubmit.next();
    };

    this.onCancelInstance = () => {
      this.close.next(false)
    }

    onSubmit
      .pipe(
        takeUntil(this.destroyed$),
        withLatestFrom(this.customFields$),
        tap((_) => {
          let properties: FeatureProperties[] =
            this.feature.getProperties() as FeatureProperties[];
          if (Object.values(properties).length > 1) {
            Object.values(properties)
              .filter((p) => p.name)
              .filter((p) => p.name != this.layerToDigitalise.fieldId)
              .map((p) => { 
                p.value = this.form.get([p.name])?.value;
                });       
            this.feature.setProperties(properties);
          } else {
            let pte = {}
            this.fields.filter((f) => f.field.name_field != this.layerToDigitalise.fieldId).map((f) => {
              pte[f.field.name_field] = this.form.get(f.field.name_field).value
            })
            this.feature.setProperties(pte)
          }
          updateAttributeFeature(this.layerToDigitalise.layer, this.feature)
          this.close.next(true);
        })
      )
      .subscribe();

    this.onDeleteInstance = () => {
      this.dialog.open(ConfirmationDialogComponent, {
        data: {
          confirmationTitle: this.translate.instant('map.edit.delete_feature'),
          confirmationExplanation: this.translate.instant('map.edit.delete_feature_explanation'),
          cancelText: this.translate.instant('no'),
          confirmText: this.translate.instant('yes'),
          danger: true
        }
      }).afterClosed().pipe(
        take(1),
        filter((result) => result),
        tap(() => {
          deleteFeature(this.layerToDigitalise.layer, this.feature)
          this.close.next(true)
        })
      ).subscribe()
    }
  }

  ngOnInit(): void {
    this.onInitInstance();
    this.userRight$=this.userHasRight(this.layerToDigitalise.layer_id)
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }


  userHasRight(layer_id: number): Observable<boolean>{
    if(this.user.is_superuser){
      return of(true);
    }
    return this.rightService.getLayersByGroup(this.user?.group_id)
    .pipe(
      catchError(() => {
        this.notifier.notify(
          "error",
          this.translate.instant("user.error_loading_right")
        );
        return EMPTY;
      }),
      map(res=>{
        if(res.write.length == 0){
          return false
        } 
        else{
          if (res.write.filter((lay) => lay.layer_id == layer_id).length > 0) return true;
          return false;
        }
      })
    )
  }

  initField(){
    let query = "MAP=" + this.layerToDigitalise.selectedFeature.couche.qgis_project +
          "&SERVICE=WFS&VERSION=1.1.0&REQUEST=DescribeFeatureType&TYPENAME=" +
          this.layerToDigitalise.selectedFeature.couche.identifiant[0]
        return this.fieldService
          .getCustomFieldsOfVectorProvider(query)
          .pipe(
            catchError((error) => {
              this.notifier.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant(
                    "map.attribute_tables.error_getting_count_fields"
                  )
              );
              // this.isLoadingResults = false;
              return EMPTY;
            }),
            tap((fields) => {
              fields
                .filter(
                  (val) => val.name_field != this.layerToDigitalise.fieldId
                )
                .map((val) => {
                  let properties: FeatureProperties[] =
                    Object.values(this.feature.getProperties()) as FeatureProperties[];
                  let pte = properties.find((feat) => feat.name == val.name_field)

                  for (let i=0; i < Object.keys(properties).length; i++) {
                    if (properties[i].name == 'longitud_1') {
                      properties[i].value = properties[i]?.value?.replace('�', '°');
                      break;
                    }
                  }

                  if(pte == undefined || pte == null){
                    //Create a default feature property
                    const newProp : FeatureProperties=
                      {
                        alias_de:val.alias_de,
                        alias_fr:val.alias_fr,
                        displayed:val.displayed,
                        name:val.name_field,
                        onglet:val.onglet,
                        order:val.order,
                        value:"",
                        tooltype:""
                      }
                    this.feature.setProperties([...properties,newProp])
                  }

                  if (pte?.value) {              
                    this.form.addControl(
                      val.name_field,
                      new FormControl(pte.value),
                      {
                        emitEvent: false,
                      }
                    );
                  } else {
                    this.form.addControl(
                      val.name_field,
                      new FormControl(null),
                      {
                        emitEvent: false,
                      }
                    );
                  }
                });
            }),
            //Après que les champs soient chargés, Commencer la vérification des champs à valeurs multiple
            switchMap((_)=>{
              return this.checkIfHasManyValues(_).pipe(tap(value=>this.fields = value))
            })
          );
  }

  /**
   * Zoomer sur une entité
   */
  zoomOnFeature() {
    if (this.feature && this.map) {
      let extent = this.feature.getGeometry().getExtent();
      this.map.getView().fit(extent, {
        maxZoom: 21,
        duration: 1000,
      });
    }
  }

  /**
   * Faire clignoter une entité
   */
  blinkFeature() {
    if (this.feature && this.map) {
      let initialStyle = this.feature.clone().getStyle()
      let blinkStyle = new Style({
        fill: new Fill({ color: "red" }),
        stroke: new Stroke({ color: "red", width: 2 }),
        image: new CircleStyle({
          radius: 4,
          stroke: new Stroke({ color: "red", width: 6 }),
          fill: new Fill({
            color: "red",
          }),
        }),
        zIndex: 99999
      });

      this.feature.setStyle(blinkStyle)
      setTimeout(() => {
        this.feature.setStyle(initialStyle)
      }, 200);
      setTimeout(() => {
        this.feature.setStyle(blinkStyle)
      }, 400);
      setTimeout(() => {
        this.feature.setStyle(initialStyle)
      }, 600);
    }
  }
  //Vérifier si les champs ont des valeurs multiples
  checkIfHasManyValues(fields:CustomField[]):Observable<FieldProperty[]>{

    //Vérification à partir de l'API
    return this.fieldService.checkIfFieldHasManyValues({
      project:this.layerToDigitalise.selectedFeature.couche.qgis_project,
      layer:this.layerToDigitalise.selectedFeature.couche.identifiant[0],
    }).pipe(
      catchError(_=>{
        return EMPTY
      }),
      map(result=>{
        let data:FieldProperty[]=[]

        //Vérifier à partir de l'Helper les champs qui ne sont pas dans le résultat de l'API
        const toCheckFromHelper = fields.filter(f=>!result.some(r=>r.field == f.name_field))
        toCheckFromHelper.forEach(f=>{
          const checkFromHelper=this.checkIfHasManyValuesFromHelper(f.name_field)

          //Ajouter le résultat dans la liste
          data.push({
            field:f,
            prop:{
              isMany:checkFromHelper,
              values: checkFromHelper ? this.getAllFieldValues(f.name_field):[]
            }
          })
        })
        
        //Map le résulat de l'API
        const data_maped = result.filter(r=>fields.some(f=>f.name_field == r.field)).map(r=>{
          const field=fields.filter(f=>f.name_field == r.field)[0]
          const field_property: FieldProperty= {
            field:field,prop:{isMany:true,values:r.choices}
          }
          return field_property
        })

        //Déscativer le loading
        this.loading = false

        //Combiner les résultats
        data =[...data,...data_maped]
        return data
    }))

  }

  /**
  * Check if field has many values
  */
  checkIfHasManyValuesFromHelper(value: string): boolean {
    if(value == undefined){
      return false
    }
    let result: boolean;
    let properties: FeatureProperties[] =
      Object.values(this.feature.getProperties()) as FeatureProperties[];
    let pte = properties.find((feat) => feat.name == value);

    let layersInToc: Array<layersInMap> = [];
    layersInToc = new CartoHelper(this.mapData).getAllLayersInToc().
    filter((layerProp) => layerProp.type_layer == 'geosmCatalogue' && layerProp.properties.couche_id == this.layerToDigitalise.layer_id)
    .filter((layerProp, index, self) => {
      return self.map((item) => item.properties.couche_id + item.properties['type']).indexOf(layerProp.properties.couche_id + layerProp.properties['type']) === index;
    })
    .map((layerProp) => {
      if (layerProp.properties['type'] == 'couche') {
        let groupLayer = this.geoData.getLayerInMap(layerProp.properties.couche_id)

        layerProp.properties.group_id
        layerProp.data = groupLayer
      }
      return layerProp
    })
    
    if(layersInToc[0].data.layer.providers.length == 0 || layersInToc[0].data.layer.providers.vs?.category?.length == 0) return false;

    for (let provider of layersInToc[0].data.layer.providers) {
      // if it's true for the current field
      if(result) break;
      for (let cat of provider.vs.category) {
        //Verify if the pte is defined
        if(pte != undefined && pte.value != undefined){
          if(cat.name == pte.value && pte.value != null && cat.name != null){
            result = true;
            break;
          }
        }
      }
    }

    return result;
  }

  /**
  * Get all field values
  */
  getAllFieldValues(value: string): Array<string> {
    let result: Array<string> = [];
    let properties: FeatureProperties[] =
      Object.values(this.feature.getProperties()) as FeatureProperties[];
    let pte = properties.find((feat) => feat.name == value);

    let layersInToc: Array<layersInMap> = [];
    layersInToc = new CartoHelper(this.mapData).getAllLayersInToc().
    filter((layerProp) => layerProp.type_layer == 'geosmCatalogue' && layerProp.properties.couche_id == this.layerToDigitalise.layer_id)
    .filter((layerProp, index, self) => {
      return self.map((item) => item.properties.couche_id + item.properties['type']).indexOf(layerProp.properties.couche_id + layerProp.properties['type']) === index;
    })
    .map((layerProp) => {
      if (layerProp.properties['type'] == 'couche') {
        let groupLayer = this.geoData.getLayerInMap(layerProp.properties.couche_id)

        layerProp.properties.group_id
        layerProp.data = groupLayer
      }
      return layerProp
    })

    for ( let provider of layersInToc[0].data.layer.providers) {
      // if we got all the field values
      if(result.length > 0) break;

      for (let cat of provider.vs.category) {
        if(cat.name == pte.value && cat.name != null){
          provider.vs.category.filter((cat) => cat.name != null).map((cat) => {
            result.push(cat.name)
          })
          break;
        }
      }
    }
    return result;
  }
  getControlsName():string[]{
    return Object.keys(this.form.controls)
  }

  removeField(field:string){
    this.dialog.open(ConfirmationDialogComponent, {
      data: {
        confirmationTitle: this.translate.instant('layer.list_field.remove_field'),
        confirmationExplanation: this.translate.instant('layer.list_field.remove_field_explanation', {field:field.replace(/_/g,' ')}),
        cancelText: this.translate.instant('no'),
        confirmText: this.translate.instant('yes'),
        danger: true
      }
    }).afterClosed().pipe(
      take(1),
      filter((result) => result),
      tap(() => {
        this.loading=true
        let query = "MAP=" + this.layerToDigitalise.selectedFeature.couche.qgis_project +
            "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=" +
            this.layerToDigitalise.selectedFeature.couche.identifiant[0] +
            "OUTPUTFORMAT=application/json";
        this.fieldService.removeField(
          query,
          {
            map:this.layerToDigitalise.selectedFeature.couche.qgis_project,
            layer:this.layerToDigitalise.selectedFeature.couche.identifiant[0],
            field_name:field
          }
        )
        .pipe(
          catchError((error)=>{
            this.notifier.notify(
              "error",
              this.translate.instant("layer.list_field.error_loading.remove_fields")
            )
            this.loading=false
            return EMPTY
          }),
          tap(value=>{
            //Désactiver le loader
            this.loading=false
            this.notifier.notify(
              "success",
              this.translate.instant('layer.list_field.message_save_success')
            )
          })
        )
        .subscribe(()=> this.fieldService.fieldSaved.emit({fields:[{name:field}], add:false, remove:true}))
      })
    ).subscribe()
  }
    
}

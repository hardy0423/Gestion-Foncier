import { Clipboard } from "@angular/cdk/clipboard";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders
} from "@angular/common/http";
import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  ViewChild
} from "@angular/core";
import { MatChip, MatChipList } from "@angular/material/chips";
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA
} from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import {
  bbox,
  BBox,
  bboxPolygon,
  buffer,
  toMercator,
  toWgs84
} from "@turf/turf";
import { NotifierService } from "angular-notifier";
import { Feature } from "geojson";
import { LayerSpecification, LngLat, Map } from "maplibre-gl";
import GeometryType from "ol/geom/GeometryType";
import {
  concat,
  EMPTY,
  forkJoin, merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
  timer
} from "rxjs";
import {
  catchError, debounceTime,
  delayWhen,
  filter,
  map, retryWhen,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
  toArray,
  withLatestFrom
} from "rxjs/operators";
import { ModelDataEdition } from "src/app/data/models/digitaliser";
import {
  BasemapsDigitaliser, LayerToDigitalise
} from "src/app/data/models/layer-to-digitalise";
import {
  FeatureProperties,
  GeometryTypeProvider,
  Group,
  Layer
} from "src/app/data/models/type";
import { FieldService } from "src/app/data/services/field.service";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import {
  DataToShareLayer,
  ShareServiceService
} from "src/app/data/services/share-service.service";
import { CartoHelper, CatalogueLayer } from "src/app/data/utils/cartoHelper";
import { booleanWithinTurf } from "src/app/data/utils/geo";
import {
  Coordinate, Feature as FeatureOl, Geometry, VectorLayer,
  VectorSource
} from "src/app/ol-module";
import { environment } from "src/environments/environment";
import { BaseMaps } from "src/helper/baseMaps";
import { FeatureEditorDialogComponent } from "../feature-editor-dialog/feature-editor-dialog.component";
import { transform} from 'ol/proj';

/**
 * interface of the model to display a sheet properties
 */
export interface DescriptiveSheetData {
  /**
   * type of layer, 'osm' for osm layers
   */
  type: "osm" | "custom";
  /**
   * Data osm layer id
   */
  layer_id: number;
  /**
   * Featur user clicked on if exist
   */
  feature?: Array<Feature>;
  /**
   * layer user clicked on
   */
  layer?: LayerSpecification;
  map: Map;
  /**
   * Coordiante at pixel where the user clicked
   */
  coordinates_3857?: Coordinate;

  getShareUrl?: (
    environment,
    ShareServiceService: ShareServiceService
  ) => string;

  /**
   * BBox of clicked
   */
  bbox_3857: BBox;

  couche: CatalogueLayer;
}

export interface FeatureForSheet extends Feature {
  provider_style_id: number;
  provider_vector_id: number;
  epsg: number;
  geometry_type: string;
  primary_key_field: string;
  typeDescriptiveSheet: "osm" | "custom";
  couche: CatalogueLayer;
  feature_display:string
}
@Component({
  selector: "app-descriptive-sheet",
  // providers: [GeoDataService],
  templateUrl: "./descriptive-sheet.component.html",
  styleUrls: ["./descriptive-sheet.component.scss"],
})
/**
 * Dislplay different descriptive sheet
 * - osm type
 */
export class DescriptiveSheetComponent implements OnInit {
  public onInitInstance: () => void;
  public onChangeFeatureInstance: () => void;

  public onEditFeatureInstance: (feat: FeatureForSheet) => void;
  /**
   * current dataOsmLAyer
   */
  dataOsmLAyer: {
    group: Group;
    layer: Layer;
  };

  /**
   * List of features from WMSGetFeatureInfo at pixel where user clicked
   */
  features$: Observable<FeatureForSheet[]>;

  environment = environment;

  // OsmSheetComponent

  /**
   * extent of the current feature, if the user want to zoom on int
   */
  extent: BBox;

  featureInfoIsLoading: boolean = false;

  @ViewChild(MatChipList) matChipList: MatChipList;

  @ViewChild(MatChipList) set matChi(matChipList: MatChipList) {
    if (matChipList) {
      if (matChipList.chips.first) {
        if (!matChipList.selected) {
          matChipList.chips.first.select();
          this.cdRef.detectChanges();
        }

        this.onChangeFeatureInstance();
      }
    }
  }

  /**
   * selected feature to display
   */
  selectedFeature$: Observable<{
    fields: Array<FeatureProperties>;
    feature: FeatureForSheet;
  }>;
  

  isLoadingDownload: boolean = false;
  isLoadingUpdate: boolean = false;

  /**
  * Emit to download
  */
 onDownloadInstance: (format: string, feat: FeatureForSheet) => void

 private readonly notifier: NotifierService;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DescriptiveSheetData[],
    public dialogRef: MatDialogRef<DescriptiveSheetComponent>,
    private http: HttpClient,
    public geoDataService: GeoDataService,
    private cdRef: ChangeDetectorRef,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    public translate: TranslateService,
    public shareServie: ShareServiceService,
    public notifierService: NotifierService,
    public dialog: MatDialog,
    public fieldService: FieldService,
  ) {
    this.notifier = notifierService;
    const onChangeFeature: Subject<void> = new Subject<void>();
    this.onChangeFeatureInstance = () => {
      onChangeFeature.next();
    };

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    onInit
      .pipe(
        filter(
          () =>
            this.geoDataService.getLayerInMap(this.data[0].layer_id) ==
            undefined
        ),
        tap(() => {
          this.closeModal();
        }),
        take(1)
      )
      .subscribe();

    this.features$ = onInit.pipe(
      // take(1),
      filter(() => {
        return (
          this.data.filter(
            (data) =>
              this.geoDataService.getLayerInMap(data.layer_id) != undefined
          ).length > 0
        );
      }),
      tap(() => {
        this.dataOsmLAyer = this.geoDataService.getLayerInMap(
          this.data[0].layer_id
        );
        this.cdRef.detectChanges();
      }),
      switchMap(() => {
        let parameters = this.data
          .filter(
            (data) =>
              this.geoDataService.getLayerInMap(data.layer_id) != undefined
          )
          .filter((data) => data.feature == undefined)
          .map((data) => {
            return this.dataOsmLAyer.layer.providers.map((provider) => {
              let url =
                environment.backendUrl +
                "/api/provider/vector/sheet?map=" +
                provider.vp.path_qgis;
              return {
                url:
                  url +
                  "&FEATURE_COUNT=3&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=" +
                  provider.vp.id_server +
                  "&QUERY_LAYERS=" +
                  provider.vp.id_server +
                  "&BBOX=" +
                  data.bbox_3857 +
                  "&CRS=EPSG:3857&INFO_FORMAT=application/json&I=50&J=50&WIDTH=101&HEIGHT=101&WITH_GEOMETRY=true",
                provider_vector_id: provider.vp,
                provider_style: provider.vs,
                typeDescriptiveSheet: data.type,
                layer: data.couche,
              };
            });
          })
          .flat();

        const headers = new HttpHeaders({ "Content-Type": "text/xml" });
        this.featureInfoIsLoading = true;
        this.cdRef.detectChanges();

        let g = concat(
          ...parameters.map((param) => {
            return this.http.get(param.url, { responseType: "text" }).pipe(
              catchError(() => {
                this.featureInfoIsLoading = false;
                this.cdRef.detectChanges();
                return EMPTY;
              }),
              map((response) => {
                let geojsonFeatures: Feature[] = JSON.parse(response).features;
                return geojsonFeatures.map((feature) => {

                  let fields: Array<FeatureProperties> = [];
                  for (let i = 0; i <= Object.keys(feature.properties).length - 1; i++) {
                    fields.push(feature.properties[i]);
                  }

                  let fields_can_display = fields.filter((field)=>field.displayed)
                  
                  let feature_display:string=fields[0].value
                  if (fields_can_display.length > 0) {
                    feature_display = fields_can_display[0].value
                  }

                  return Object.assign(feature, {
                    primary_key_field:
                      param.provider_vector_id.primary_key_field,
                    provider_vector_id:
                      param.provider_vector_id.provider_vector_id,
                    provider_style_id: param.provider_style.provider_style_id,
                    epsg: param.provider_vector_id.epsg,
                    geometry_type: param.provider_vector_id.geometry_type,
                    typeDescriptiveSheet: param.typeDescriptiveSheet,
                    couche: param.layer,
                    display:feature_display
                  });
                });
              })
            );
          })
        ).pipe(
          /** retry 3 times after 2s if querry failed  */
          retryWhen((errors) =>
            errors.pipe(
              tap((val: HttpErrorResponse) => {
              }),
              delayWhen((val: HttpErrorResponse) => timer(2000)),
              // delay(2000),
              take(3)
            )
          ),
          toArray(),
          tap((values) => {
            this.featureInfoIsLoading = false;
            this.cdRef.detectChanges();
          }),
          map((values) => {
            return [].concat.apply([], values) as FeatureForSheet[];
          })
        );

        let q = this.data
          .filter(
            (data) =>
              this.geoDataService.getLayerInMap(data.layer_id) != undefined
          )
          .filter((data) => data.feature != undefined)
          .map((data) => {
            let dataOsmLAyer = this.geoDataService.getLayerInMap(data.layer_id);
            let layerProvider = dataOsmLAyer.layer.providers.find(
              (pv) => data.couche.identifiant.indexOf(pv.vp.id_server) != -1
            );
            
            for (let i=0; i < Object.keys(data.feature[0].properties).length; i++) {
              if (data.feature[0].properties[i].name == 'longitud_1') {
                data.feature[0].properties[i].value = data.feature[0].properties[i].value.replace('�', '°');
                break;
              }
            }
                  
            let a: FeatureForSheet[] = data.feature.map((feature) => {

              let fields: Array<FeatureProperties> = [];
              for (let i = 0; i <= Object.keys(feature.properties).length - 1; i++) {
                fields.push(feature.properties[i]);
              }

              let fields_can_display = fields.filter((field)=>field.displayed)
              
              let feature_display:string=fields[0].value
              if (fields_can_display.length > 0) {
                feature_display = fields_can_display[0].value
              }

              return Object.assign(feature, {
                primary_key_field: layerProvider.vp.primary_key_field,
                provider_vector_id: layerProvider.vp.provider_vector_id,
                epsg: layerProvider.vp.epsg,
                provider_style_id: layerProvider.vs.provider_style_id,
                typeDescriptiveSheet: data.type,
                couche: data.couche,
                geometry_type: layerProvider.vp.geometry_type,
                feature_display:feature_display
              });
            });

            return a;
          })
          .flat();
        let k = [of(q), g];
        return forkJoin(...k).pipe(map((df) => df[0].concat(df[1])));
      }),
      map((layers) => {
        layers.forEach(layer => {
          for (let i=0; i < Object.keys(layer.properties).length; i++) {
            if (layer.properties[i].value == 'null' || layer.properties[i].value == null) {
              layer.properties[i].value = '';
            }
          }
        });
        return layers;
      })
    );


    const onDownload: Subject<[string, FeatureForSheet]> = new Subject<[string, FeatureForSheet]>();

    this.onDownloadInstance = (format: string, feat: FeatureForSheet) => {
      onDownload.next([format, feat]);
    };

    onDownload.pipe(
      takeUntil(this.destroyed$),
      switchMap(([format, feat]) =>{
        this.isLoadingDownload = true;
        this.cdRef.detectChanges()

        let querry = "map=" + feat.couche.qgis_project +
          "&SERVICE=WFS&VERSION=1.3.0&REQUEST=GetFeature&OUTPUTFORMAT=" + format + "&TYPENAME=" +
          feat.couche.identifiant[0] +'&FEATUREID='+ feat.id

          return this.fieldService.downloadFeatures(querry).pipe(
            take(1),
            catchError((error: HttpErrorResponse) => {
              this.isLoadingDownload = false;
              this.notifier.notify("error", error.error?.msg ? error.error.msg : this.translate.instant('map.attribute_tables.error_download_features'))
              // Cacher le spinner et activer le bouton imprimer
              // this.showLoading = () => {
              //   return false;
              // }
              return EMPTY
            }),
            tap((response) => {
              // It is necessary to create a new blob object with mime-type explicitly set
              // otherwise only Chrome works like it should
              var newBlob = new Blob([response]);
  
              // For other browsers: 
              // Create a link pointing to the ObjectURL containing the blob.
              const data = window.URL.createObjectURL(newBlob);
  
              var link = document.createElement('a');
              link.href = data;
              let extension = format
              if (extension == 'shp') {
                extension = 'zip'
              }
              link.download = feat.couche.identifiant[0]+'.'+extension;
              // this is necessary as link.click() does not work on the latest firefox
              link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  
              setTimeout(function () {
                // For Firefox it is necessary to delay revoking the ObjectURL
                window.URL.revokeObjectURL(data);
                link.remove();
              }, 100);
  
              this.isLoadingDownload = false;
            })
          )
      })

    ).subscribe()

    const onEditFeature: Subject<FeatureForSheet> =
      new Subject<FeatureForSheet>();
    this.onEditFeatureInstance = (feat: FeatureForSheet) => {
      onEditFeature.next(feat);
    };

    this.selectedFeature$ = merge(
      onChangeFeature, 
      this.features$
      ).pipe(
      debounceTime(500),
      withLatestFrom(this.features$),
      filter(
        (params) => params[1] != undefined && this.matChipList != undefined
      ),
      map((parammms) => {
        let chipSelected = this.matChipList.selected;
        if (chipSelected instanceof MatChip) {
          let feature = chipSelected.value as FeatureForSheet;
          let fields: Array<FeatureProperties> = [];

          let geoJsonData = {
            type: "FeatureCollection",
            features: [feature],
          };
          let geoJsonDataLatLng = toWgs84(geoJsonData);

          let fieldsCount = Object.keys(feature.properties).length - 1;
          for (let i = 0; i <= fieldsCount; i++) {
            if (feature.properties[i].name == "id") {
              feature.primary_key_field = feature.properties[i].name;
            }
            // Remplacer les champs "null" par ""
            feature.properties[i].value = feature.properties[i].value.toString().replace(/[\(\)]*\bnull\b[\(\)]*/gi, "").trim();

            fields.push(feature.properties[i]);
          }

          this.extent = feature.bbox ? feature.bbox : undefined;

          let highlightLayerData: CatalogueLayer = {
            type: "geojson",
            nom: "highlight",
            geometryType: feature.geometry.type as GeometryTypeProvider,
            cluster: false,
            data_geojson: geoJsonDataLatLng,
          };

          let cartoHelperClass = new CartoHelper(this.data[0].map);
          let source_name = highlightLayerData.nom + "_maplibre_source";
          let layer_name = highlightLayerData.nom + "_maplibre_layer";

          if (
            cartoHelperClass.map.getSource(source_name) &&
            cartoHelperClass.map.getLayer(layer_name)
          ) {
            cartoHelperClass.map.removeLayer(layer_name);
            cartoHelperClass.map.removeSource(source_name);
          }
          let highlightLayer =
            cartoHelperClass.constructLayer(highlightLayerData);
          cartoHelperClass.map.addLayer(highlightLayer);
          this.dataOsmLAyer = this.geoDataService.getLayerInMap(
            feature.couche.properties.couche_id
          );
          return {
            fields: fields,
            feature: feature,
          };
        }
        return undefined;
      }),
      shareReplay(1)
    );

    onEditFeature
    .pipe(
      takeUntil(this.destroyed$),
      switchMap((feat) => {
        this.isLoadingUpdate = true;
        let bufferedBbox = bbox(
          toMercator(
            buffer(toWgs84(bboxPolygon(feat.bbox)), 125, { units: "meters" })
          )
        );
        let url =
          environment.backendUrl +
          "/api/provider/vector/sheet?map=" +
          feat.couche.qgis_project +
          "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=" +
          feat.couche.identifiant[0] +
          "&BBOX=" +
          bufferedBbox +
          "&SRSNAME=EPSG:3857&OUTPUTFORMAT=application/json";

        return this.http.get(url, { responseType: "text" }).pipe(
          catchError(() => {
            this.cdRef.detectChanges();
            return EMPTY;
          }),
          switchMap((response) => {
            if(!feat.epsg) {
              this.notifierService.notify("error", this.translate.instant('map.edit.no_crs_defined'))
              return EMPTY
            }
            let geojsonFeatures: Feature[] = JSON.parse(response).features;
            let editLayerData: CatalogueLayer = {
              type: "geojson",
              nom: "edit",
              geometryType: feat.geometry.type as GeometryTypeProvider,
              cluster: false,
              data_geojson: {
                type: "FeatureCollection",
                features: geojsonFeatures,
              },
            };

            let olVlayer = new CartoHelper(data[0].map).constructOLayer(
              editLayerData
            );

            let layerToDigitalise: LayerToDigitalise[] = [
              {
                legend: null,
                style: null,
                nom: feat.couche.identifiant[0],
                canBeDelete: true,
                canBeAdd: true,
                canBeUpdate: true,
                typologie: feat.geometry_type,
                layer: olVlayer,
                selectedFeature: feat,
                layer_id: feat.couche.properties.couche_id,
                fieldId: feat.primary_key_field,
                geometryCanBeEditByOthers: true
              },
            ];

            let basemaps: BasemapsDigitaliser = {
              bamesMaps: [
                {
                  layer: new BaseMaps().getMapLibreLayerOl(),
                  source: new BaseMaps().getMapLibreLayerOl().getSource(),
                  nom: "Plan",
                  type: "fond",
                  visible: false,
                },
                {
                  layer: new BaseMaps().getIgnLayerOl(),
                  source: new BaseMaps().getIgnLayerOl().getSource(),
                  nom: "Satellite",
                  type: "fond",
                  visible: true,
                },
              ],
            };

            let editData: ModelDataEdition = {
              basemaps: basemaps,
              layersToDigitalise: layerToDigitalise,
              map: this.data[0].map,
              // getAllLegendsToNotSHow:function(layersToDigitalise){
              //   let val = layersToDigitalise.map((layersToD)=>{
              //     let uniqueAlias = layersToD.layer.getSource().getFeatures().map((feature)=>feature.get('alias')).filter((value, index, self)=>{
              //       return self.indexOf(value) === index;
              //     })

              //     return uniqueAlias.map((alias)=>{
              //       return {
              //         alias,
              //         typologie:layersToD.typologie
              //       }
              //     })
              //   })

              //   return [].concat.apply([], val)
              // },

              canCommitAttribute: function (params: Array<{
                feature: FeatureOl<Geometry>;
                layerToDigitalise: LayerToDigitalise;
              }>) {
                return []
                // return params
                //   .filter((pte) => {
                //     let prop = pte.feature.getProperties() as FeatureProperties[]
                //     return Object.values(prop).length < 2
                //     // return prop[0].value == undefined
                //   })
                //   .slice(0, 1)
                //   .map((pte) => {
                //     return pte.feature
                //   })
              },
              canCommitGeometrys: function (allComitedFeatures: {
                feature: FeatureOl<Geometry>;
                layerToDigitalise: LayerToDigitalise;
              }[]) {
                let emprisesGeometry: Array<Geometry> = this.layersToDigitalise
                  .map((item) => {
                    let layer: VectorLayer<VectorSource<Geometry>> = item.layer;
                    return layer
                  })
                  // .map((layer) => layer.getSource().getFeatures()
                  //   .filter((feature) => feature.get('alias') == 'PERI')
                  // )
                  .reduce((acc, val) => acc.concat(val), [])
                  .map((feature) => feature.getGeometry())

                  return allComitedFeatures
                      .filter((feature) => feature.feature.getGeometry().getType() === 'Polygon'|| 'LineString' || 'Point' || 'MultiPolygon' || 'MultiLineString' || 'MultiPoint')
                      .map((feature) => {
                        let checkFeature = emprisesGeometry
                          .map((empriseGeom) => booleanWithinTurf(feature.feature.getGeometry(), empriseGeom))
                          .find((response) => response === true)
                        if(!checkFeature) {
                          return feature
                        }
                        return null
                      })
                      .filter((feature) => feature)
              }
            };
            this.isLoadingUpdate = false;
            return this.dialog
              .open(FeatureEditorDialogComponent, {
                height: "95%",
                width: "90%",
                data: editData,
                disableClose: true
              })
              .afterClosed().pipe(
                filter((res) => res),
                tap(() => {
                  this.notifierService.notify(
                    "success",
                    this.translate.instant("map.edit.success_saving_layer")
                  );
                  let cartoHelper = new CartoHelper(this.data[0].map)
                  cartoHelper.addOrReloadWms(this.data[0].couche)
                  this.onInitInstance()
                  setTimeout(() => {
                    let selected: MatChip = this.matChipList.selected as MatChip
                    this.matChipList.chips.find((chip) => chip.value['id'] == selected.value['id']).select()
                    this.onChangeFeatureInstance()
                    this.fieldService.fieldSaved.subscribe();
                  }, 1000);
                })
              );
          })
        );
      })
    ).subscribe();

    this.fieldService.fieldSaved
    .pipe(
      switchMap(({fields, add, remove})=>{
        if (add || remove) {
          this.selectedFeature$ = this.selectedFeature$.pipe(
            switchMap((feature) => {
              if (add) {
                let maxOrder = feature.fields.reduce((max, current) => (current.order > max ? current.order : max), -Infinity);
                fields.forEach(f => {
                  let field: FeatureProperties = {
                    alias_de: f.name,
                    alias_fr: f.alias || f.name,
                    displayed: true,
                    name: f.name,
                    onglet: "Général",
                    order: maxOrder + 1,
                    tooltip: false,
                    search: false,
                    value: f.value || "",
                    typefield: f.data_type
                  }
                  if (!feature.fields.some(element => element.name == field.name)) {
                    feature.fields.push(field);
                  }
                  maxOrder++;
                });
              }
              if (remove) {
                feature.fields = feature.fields.filter((f) => f.name != fields[0].name);
              }
              return of({feature: feature.feature, fields: feature.fields});
            })
          )
          this.selectedFeature$.subscribe();
          this.onChangeFeatureInstance();
          return EMPTY;
        } else {
          return EMPTY;
        }
      })
    ).subscribe()
  }

  ngOnInit(): void {
    this.onInitInstance();
  }
  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  ngOnDestroy() {
    // this.highlightLayer.getSource().clear();
    this.destroyed$.complete();
  }

  toggleSelection(chip: MatChip) {
    chip.toggleSelected();
    this.cdRef.detectChanges();
    this.onChangeFeatureInstance();
  }

  /**
   * Close modal
   */
  closeModal(): void {
    var cartoClass = new CartoHelper(this.data[0].map);
    let source_name = "highlight_maplibre_source";
    let layer_name = "highlight_maplibre_layer";
    if (
      cartoClass.map.getSource(source_name) &&
      cartoClass.map.getLayer(layer_name)
    ) {
      cartoClass.map.removeLayer(layer_name);
      cartoClass.map.removeSource(source_name);
    }

    this.dialogRef.close();
  }

  /**
   * Zoom on feature extent
   */
  zoomOnFeatureExtent() {
    if (this.extent) {
      var cartoClass = new CartoHelper(this.data[0].map);
      cartoClass.fitBounds(this.extent);
    }
  }

  /**
   * Covert a color from hex to rgb
   * @param hex string
   * @return  {r: number, g: number, b: number }
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Share this feature
   */
  shareFeature(feature: FeatureForSheet) {
    // var url =  this.descriptiveModel.getShareUrl(environment,this.ShareServiceService)

    let pteLayerToGetParams: Array<DataToShareLayer> = this.data.map(
      (sheetData) => {
        let groupLayer = this.geoDataService.getLayerInMap(
          sheetData.couche.properties.couche_id
        );
        return {
          id_layer: sheetData.couche.properties.couche_id,
          group_id: groupLayer.group.group_id,
          type: "layer",
        };
      }
    );
    //Retrieve center's coordinates
    var { lng, lat }: LngLat = this.data[0].map.getCenter();
    let coord_3857: Coordinate = [this.data[0].coordinates_3857[0], this.data[0].coordinates_3857[1]]; 
    let c_3857 = transform(coord_3857, 'EPSG:3857', 'EPSG:4326');

    var zoom = this.data[0].map.getZoom();

    var coordinateSharedLink =
      // "pos=" + lng.toFixed(4) + "," + lat.toFixed(4) + "," + Math.floor(zoom);
      "pos=" + c_3857[0].toFixed(4) + "," + c_3857[1].toFixed(4) + "," + Math.floor(zoom);

    var params = this.shareServie.shareLayers(pteLayerToGetParams);

    var featureParams =
      "feat=" +
      feature.couche.properties.couche_id +
      "," +
      feature.provider_vector_id +
      "," +
      feature.id;

    var bbox_3857_params = "bbox=" + this.data[0].bbox_3857;

    var url_share =
      environment.frontendUrl +
      "/map?" +
      params +
      "&" +
      coordinateSharedLink +
      "&" +
      featureParams +
      "&" + 
      bbox_3857_params; 

    this._snackBar
      .open(this.truncateUrl(url_share), this.translate.instant("copy"), {
        duration: 7 * 1000,
        panelClass: ["primary-snackbar"],
      })
      .onAction()
      .pipe(
        tap(() => {
          this.clipboard.copy(url_share);
          this._snackBar.open(
            this.translate.instant("share.link_copied"),
            this.translate.instant("close"),
            {
              duration: 5 * 1000,
              panelClass: ["primary-snackbar"],
            }
          );
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();
  }
  /**
   * Truncate Url
   * @param url
   * @returns
   */
  truncateUrl(url: string): string {
    return url.slice(0, 35).toString() + "...";
  }
}

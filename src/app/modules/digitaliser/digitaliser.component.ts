import {
  Component,
  ComponentFactoryResolver,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { NotifierService } from "angular-notifier";
import { isEmpty } from "ol/extent";
import Feature, { FeatureLike } from "ol/Feature";
import Map from "ol/Map";
import { unByKey } from "ol/Observable";
import VectorSource, { VectorSourceEvent } from "ol/source/Vector";
import {
  BehaviorSubject,
  EMPTY,
  merge,
  of,
  ReplaySubject,
  Subject,
  Subscriber,
  zip,
} from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import {
  catchError,
  filter,
  map,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import { FormDirective } from "src/app/data/directives/form.directive";
import {
  BasemapsDigitaliser,
  DataForLegend,
  LayerToDigitalise,
  ResultOfDigitalise,
} from "src/app/data/models/layer-to-digitalise";
import { LoadComponentService } from "src/app/data/services/load-component.service";
import {
  Attribution,
  CircleStyle,
  createEmptyExtent,
  defaultControls,
  Extent,
  Fill,
  fromLonLat,
  GeoJSON,
  Geometry,
  getProjection,
  OSM,
  Stroke,
  Style,
  TileLayer,
  VectorLayer,
  View,
  WFS,
  WriteTransactionOptions,
  Zoom,
} from "src/app/ol-module";

import {register} from 'ol/proj/proj4';

import { AddGeometry } from "./class/addGeometry";
import { AddRingToGeometry } from "./class/addRingToGeometry";
import { MergeFeature } from "./class/mergeFeature";
import { UpdateAttributes } from "./class/updateAttributes";
import { UpdateGeometry } from "./class/updateGeometry";
// import { FeaturePopup } from './class/featurePopup';
import { MatDialog } from "@angular/material/dialog";
import { Draw, Modify, Select, Snap } from "ol/interaction";
import { ModelDataEdition } from "src/app/data/models/digitaliser";
import { BackendApiService } from "src/app/data/services/backend-api.service";
import { ConfirmationDialogComponent } from "src/app/shared/pages/confirmation-dialog/confirmation-dialog.component";
import { MesureComponent } from "src/app/shared/pages/mesure/mesure.component";
import {
  getAllAddFeatureFromLayer,
  getAllDeletedFeatureFromLayer,
  getAllUpdatedFeatureFromLayer,
  initialiseSourceForDigitaliser,
} from "./class/featureCrud";
import { FeatureProperties } from "src/app/data/models/type";
import * as proj4 from "proj4";
import { MapsService } from "src/app/data/services/maps.service";
import { Projection } from "ol/proj";
import { HttpErrorResponse } from "@angular/common/http";
import { TranslateService } from "@ngx-translate/core";
import { Map as MapData} from "maplibre-gl";

@Component({
  selector: "app-digitaliser",
  templateUrl: "./digitaliser.component.html",
  styleUrls: ["./digitaliser.component.scss"],
})
export class DigitaliserComponent implements OnInit {
  public onInitInstance: () => void;
  public onSubmitInstance: () => void;
  public onCloseInstance: () => void;
  /**
   * is the digitaliser modify ?
   */
  public isDigitaliserDirty: () => boolean;
  public onDisableAllOperationInstance: () => void;
  public toogleUpdateAttributeInstance: () => void;
  public toogleUpdateGeometryInstance: () => void;
  public toogleAddGeometryInstance: () => void;
  public toogleAddRingToGeometryInstance: () => void;
  public toogleMergeFeatureInstance: () => void;

  @Input() layersToDigitalise: Array<LayerToDigitalise>;
  @Input() basemapsDigitaliser: BasemapsDigitaliser;
  // @Input() sites_id: number;
  @Input() data: ModelDataEdition;
  @Input() mapData: MapData;
  @Output() close: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild("mapDiv") set mapDiv(mapDiv: ElementRef) {
    if (mapDiv) {
      this.map.setTarget(mapDiv.nativeElement);
    }
  }

  @ViewChild(FormDirective, { static: true })
  formHost: FormDirective;

  // @ViewChild("popupTemplate", { read: ViewContainerRef })
  // popupTemplate: ViewContainerRef;

  @ViewChild("customNotification", { static: true })
  customNotificationTmpl: TemplateRef<HTMLElement>;

  @ViewChild(MesureComponent, { static: true })
  mesureComp: MesureComponent;

  geometryType: string = ''

  public updateAttributesInstance: UpdateAttributes;
  public updateGeometryInstance: UpdateGeometry;
  public addGeometryIntance: AddGeometry;
  public addRingToGeometry: AddRingToGeometry;
  public mergeFeature: MergeFeature;

  view = new View({
    center: fromLonLat([7.52047, 47.60025]),
    zoom: 13,
    minZoom: 6,
    constrainResolution: true,
  });

  map = new Map({
    maxTilesLoading: 50,
    view: this.view,
    controls: defaultControls({ attribution: false, zoom: false }).extend([
      new Attribution({ collapsible: false }),
    ]),
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
    ],
  });

  /**
   * is digitaliser ready ? means every features are loaded
   */
  isReady: boolean = false;

  /**
   * listes des données pour la légende
   */
  dataForLegends: Array<BehaviorSubject<DataForLegend[]>> = [];
  loading: boolean = false;

  /**   * est ce que le digitaliseur a déja enregistré au moins une fois ?
   */
  updateSaved: boolean = false;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public loadComponentService: LoadComponentService,
    public notifierService: NotifierService,
    public dialog: MatDialog,
    public resolver: ComponentFactoryResolver,
    public backendApiService: BackendApiService,
    public mapService: MapsService,
    public translate: TranslateService
  ) {
    this.onDisableAllOperationInstance = () => {
      if (this.updateAttributesInstance.isEnable) {
        this.updateAttributesInstance.disable();
      }
      if (this.updateGeometryInstance.isEnable) {
        this.updateGeometryInstance.disable();
      }
      if (this.addGeometryIntance.isEnable) {
        this.addGeometryIntance.disable();
      }

      if (this.addRingToGeometry.isEnable) {
        this.addRingToGeometry.disable();
      }


      if (this.mergeFeature.isEnable) {
        this.mergeFeature.disable();
      }
    };

    this.toogleUpdateAttributeInstance = () => {
      if (this.updateAttributesInstance.isEnable) {
        this.updateAttributesInstance.disable();
      } else {
        this.onDisableAllOperationInstance();
        this.updateAttributesInstance.enable();
      }
    };

    this.toogleUpdateGeometryInstance = () => {
      if (this.updateGeometryInstance.isEnable) {
        this.updateGeometryInstance.disable();
      } else {
        this.onDisableAllOperationInstance();
        this.updateGeometryInstance.enable();
      }
    };

    this.toogleAddGeometryInstance = () => {
      if (this.addGeometryIntance.isEnable) {
        this.addGeometryIntance.disable();
      } else {
        this.onDisableAllOperationInstance();
        this.addGeometryIntance.enable();
      }
    };

    this.toogleAddRingToGeometryInstance = () => {
      if (this.addRingToGeometry.isEnable) {
        this.addRingToGeometry.disable();
      } else {
        this.onDisableAllOperationInstance();
        this.addRingToGeometry.enable();
      }
    };

    this.toogleMergeFeatureInstance = () => {
      if (this.mergeFeature.isEnable) {
        this.mergeFeature.disable();
      } else {
        this.onDisableAllOperationInstance();
        this.mergeFeature.enable();
      }
    };

    this.isDigitaliserDirty = () => {
      try {
        return (
          this.layersToDigitalise
            .filter((item) => item.canBeUpdate)
            .map((item) => {
              return (
                getAllAddFeatureFromLayer(item.layer).length +
                getAllDeletedFeatureFromLayer(item.layer).length +
                getAllUpdatedFeatureFromLayer(item.layer).length
              );
            })
            .reduce((a, b) => a + b, 0) > 0
        );
      } catch (error) {
        return false;
      }
    };

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    onInit
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.layersToDigitalise != undefined),
        tap((_) => {
          this.map
            .getLayers()
            .getArray()
            .slice()
            .map((layer) => this.map.removeLayer(layer));
          this.map
            .getInteractions()
            .getArray()
            .slice()
            .filter(
              (interaction) =>
                interaction instanceof Snap ||
                interaction instanceof Select ||
                interaction instanceof Modify ||
                interaction instanceof Draw
            )
            .map((interaction) => this.map.removeInteraction(interaction));

          this.basemapsDigitaliser.bamesMaps.map((baseMap) => {
            let layer = baseMap.layer;
            layer.setVisible(baseMap.visible);
            layer.set("nom", baseMap.nom);
            layer.set("type", baseMap.type);
            this.map.addLayer(layer);
            this.map.updateSize();
          });
        }),
        tap(() => {
          // this.loading = true;
          let featuresloadendEvent: Array<
            Observable<VectorSourceEvent<Geometry>>
          > = [];
          let featuresloadErrorEvent: Array<
            Observable<VectorSourceEvent<Geometry>>
          > = [];

          // let selectedFeature: Feature;
          this.geometryType = this.layersToDigitalise[0].selectedFeature.geometry_type
          
          this.layersToDigitalise.map((layerToDigitalise) => {
            let layer = layerToDigitalise.layer;
            // layer.getSource().refresh();
            layer.set("layerToDigitaliseID", layerToDigitalise.layer_id);
            layer.setZIndex(1);
            // layer.setStyle((feature: FeatureLike, resolution: number) => {
            //   return layerToDigitalise.style(feature, resolution);
            // });

            // let features = layer.getSource().getFeatureById

            this.map.addLayer(layer);

            let source: VectorSource<Geometry> = layer.getSource();
            initialiseSourceForDigitaliser(source);

            featuresloadendEvent.push(
              fromOpenlayerEvent<VectorSourceEvent<Geometry>>(
                layer.getSource(),
                "featuresloadend"
              )
            );
            featuresloadErrorEvent.push(
              fromOpenlayerEvent<VectorSourceEvent<Geometry>>(
                layer.getSource(),
                "featuresloaderror"
              )
            );
          });

          /**
           * if all features have not loaded normally this will fire
           */
          merge(featuresloadErrorEvent)
            .pipe(
              take(1),
              switchMap((event) => {
                return event;
              }),
              tap((event) => {
                this.loading = false;
                this.isReady = false;
                alert(this.translate.instant('map.edit.error_loading_data'));
              })
            )
            .subscribe();

          /**
           * is all features have load normally, this will fire
           */
          merge(featuresloadendEvent)
            .pipe(
              take(1),
              tap((event) => {
                // let extent = createEmptyExtent();
                // initialiseSourceForDigitaliser(source);
                // Extent(extent, source.getExtent());

                // this.dataForLegends = this.layersToDigitalise.map(
                //   (layerToDigitalise) => layerToDigitalise.legend
                // );

                const viewContainerRef = this.formHost.viewContainerRef;

                this.updateAttributesInstance = new UpdateAttributes(
                  this.map,
                  this.layersToDigitalise
                    .filter((item) => item.canBeUpdate)
                    .map((item) => item.layer),
                  this.layersToDigitalise,
                  viewContainerRef,
                  this.loadComponentService,
                  this.notifierService,
                  this.dialog,
                  this.customNotificationTmpl,
                  this.translate,
                  this.mapData
                );

                this.updateGeometryInstance = new UpdateGeometry(
                  this.map,
                  this.layersToDigitalise
                    .filter((item) => item.canBeUpdate)
                    .map((item) => item.layer),
                  this.layersToDigitalise,
                  this.notifierService,
                  this.customNotificationTmpl,
                  this.translate
                );

                this.addGeometryIntance = new AddGeometry(
                  this.map,
                  this.layersToDigitalise
                    .filter((item) => item.canBeUpdate)
                    .map((item) => item.layer),
                  this.layersToDigitalise,
                  viewContainerRef,
                  this.loadComponentService,
                  this.notifierService,
                  this.dialog,
                  // this.sites_id,
                  this.customNotificationTmpl,
                  this.translate,
                  this.mapData
                );

                this.addRingToGeometry = new AddRingToGeometry(
                  this.map,
                  this.layersToDigitalise
                    .filter(
                      (item) =>
                        item.canBeUpdate && item.geometryCanBeEditByOthers
                    )
                    .map((item) => item.layer),
                  this.layersToDigitalise.filter(
                    (item) => item.geometryCanBeEditByOthers
                  ),
                  viewContainerRef,
                  this.loadComponentService,
                  this.notifierService,
                  this.dialog,
                  this.customNotificationTmpl,
                  this.translate
                );

                this.mergeFeature = new MergeFeature(
                  this.map,
                  this.layersToDigitalise
                    .filter((item) => item.canBeUpdate)
                    .map((item) => item.layer),
                  this.layersToDigitalise,
                  viewContainerRef,
                  this.loadComponentService,
                  this.notifierService,
                  this.customNotificationTmpl,
                  this.translate
                );

                // new FeaturePopup(
                //   this.map,
                //   this.layersToDigitalise.map((item) => item.layer),
                //   this.popupTemplate,
                //   this.resolver
                // )

                let feature = this.layersToDigitalise[0].layer
                  .getSource()
                  .getFeatureById(
                    this.layersToDigitalise[0].selectedFeature.id
                  );
                this.updateAttributesInstance.enable();
                this.updateAttributesInstance.selectFeature(feature);
                let extent = feature.getGeometry().getExtent();

                if (!isEmpty(extent)) {
                  window.setTimeout(() => {
                    this.view.fit(extent, {
                      duration: 500,
                      maxZoom: 20,
                    });
                  }, 500);
                  this.isReady = true;
                }

                this.loading = false;
              })
            )
            .subscribe();
        })
      )
      .subscribe();

    this.onCloseInstance = () => {
      if (this.isDigitaliserDirty()) {
        this.dialog
          .open(ConfirmationDialogComponent, {
            data: {
              confirmationTitle: this.translate.instant('map.edit.save_before_close'),
              confirmationExplanation:
                this.translate.instant('map.edit.do_you_want_to_save'),
              cancelText: this.translate.instant('map.edit.close_without_saving'),
              confirmText: this.translate.instant('map.edit.save_edit'),
            },
            width: "35%",
          })
          .afterClosed()
          .pipe(
            take(1),
            tap((result) => {
              if (result) {
                this.onSubmitInstance();
              } else {
                this.close.emit(this.updateSaved);
              }
            })
          )
          .subscribe();
      } else {
        this.close.emit(this.updateSaved);
      }
    };

    const onSubmit: Subject<void> = new Subject<void>();
    this.onSubmitInstance = () => {
      onSubmit.next();
    };

    onSubmit
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.loading = true;
          let epsg = this.layersToDigitalise[0].selectedFeature.epsg;
          const newProjCode = "EPSG:" + epsg;
          let newProj = getProjection(newProjCode);
          if (!newProj) {
            return this.mapService.searchProjection(newProjCode).pipe(
              map((res) => {
                let results = res.results;
                if (results && results.length > 0) {
                  results.forEach((proj) => {
                    proj4.default.defs(newProjCode, proj.exports.proj4);
                    register(proj4 as typeof import("proj4"));
                  });
                  newProj = getProjection(newProjCode);
                  return getProjection(newProjCode);
                }
 
                return null;
              })
            );
          }
          return of(newProj);
        }),
        map((proj) => {
          if (proj) {
            let data: ResultOfDigitalise = {
              updates: [],
              deletes: [],
              inserts: [],
            };

            let addFeatures: Array<{
              feature: Feature<Geometry>;
              layerToDigitalise: LayerToDigitalise;
            }> = [].concat.apply(
              [],
              this.layersToDigitalise
                .filter((item) => item.canBeUpdate)
                .map((item) =>
                  getAllAddFeatureFromLayer(item.layer).map((feat) => {
                    return { feature: feat, layerToDigitalise: item };
                  })
                )
            );

            let deletedFeatures: Array<{
              feature: Feature<Geometry>;
              layerToDigitalise: LayerToDigitalise;
            }> = [].concat.apply(
              [],
              this.layersToDigitalise
                .filter((item) => item.canBeUpdate)
                .map((item) =>
                  getAllDeletedFeatureFromLayer(item.layer).map((feat) => {
                    return { feature: feat, layerToDigitalise: item };
                  })
                )
            );

            let updatedFeatures: Array<{
              feature: Feature<Geometry>;
              layerToDigitalise: LayerToDigitalise;
            }> = [].concat.apply(
              [],
              this.layersToDigitalise
                .filter((item) => item.canBeUpdate)
                .map((item) =>
                  getAllUpdatedFeatureFromLayer(item.layer).map((feat) => {
                    return { feature: feat, layerToDigitalise: item };
                  })
                )
            );

            let wrongFeatures = this.data.canCommitAttribute([
              ...addFeatures,
              ...updatedFeatures,
            ]);
            wrongFeatures.map((feature) => {
              notifierService.notify("error", this.translate.instant('map.edit.fill_your_features'));
              if (!this.updateAttributesInstance.isEnable) {
                this.toogleUpdateAttributeInstance();
              }
              this.updateAttributesInstance.selectFeature(feature);
            });

            if (wrongFeatures.length > 0) {
              this.loading = false;
              return null;
            }

            // let outerFeatures: Array<Feature<Geometry>> = this.data
            //   .canCommitGeometrys(updatedFeatures.concat(addFeatures))
            //   .map((feature) => feature.feature.clone());
            // if (outerFeatures.length > 0) {
            //   this.blinkFeature(outerFeatures);
            //   notifierService.notify(
            //     "error",
            //     "Toutes vos entités doivent être dans au moins une emprise"
            //   );
            //   return null;
            // }

            addFeatures.map((pte) => {
              let newFeature = this.transformFeaturesForWfs(pte, proj, true);
              console.log("id",newFeature.getId())
              let featureToUpdate = this.transformFeaturesForWfs(pte, proj)
              data.inserts.push(newFeature);
              data.updates.push(featureToUpdate);
            });

            deletedFeatures.map((pte) => {
              data.deletes.push(pte.feature);
            });

            updatedFeatures.map((pte) => {
              pte.feature.setProperties(this.updateNullFieldValue(pte));
              let newFeature = this.transformFeaturesForWfs(pte, proj);
              data.updates.push(newFeature);
            });

            if (
              data.updates.length + data.deletes.length + data.inserts.length ==
              0
            ) {
              this.notifierService.notify(
                "info",
                this.translate.instant("map.edit.no_edit_to_save")
              );
            }

            return data;
          } else {
            this.notifierService.notify(
              "error",
              this.translate.instant("map.edit.no_crs_not_found")
            );
            this.loading = false;
            return null;
          }
        }),
        filter(
          (data) =>
            data &&
            data.updates.length + data.deletes.length + data.inserts.length > 0
        ),
        switchMap((data) => {
          
          const featureType = this.layersToDigitalise[0].nom
          const newEntitiesTransaction = this.mapService.generateTransaction(
            data.inserts, [], [], featureType)
          const baseTransaction = this.mapService.generateTransaction(
            [], 
            data.updates, 
            data.deletes,
            featureType)
          let query =
            "map=" +
            this.layersToDigitalise[0].selectedFeature.couche.qgis_project +
            "&SERVICE=WFS&VERSION=1.1.0&TYPENAME=" +
            this.layersToDigitalise[0].nom;

          return this.mapService.manageFeatures(query,{
            insert_transaction: newEntitiesTransaction,
            base_transaction: baseTransaction,
            default_ids: data.inserts.map(feauture=> feauture.getId())
          }).pipe(
            catchError((error: HttpErrorResponse) => {
              this.loading = false;

              this.notifierService.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant("map.edit.error_saving_layer")
              );

              return EMPTY;
            }),
            tap((res) => {
              this.updateSaved = true;
              this.layersToDigitalise.map((l) => {
                let source = l.layer.getSource()
                initialiseSourceForDigitaliser(source)

              })
              this.loading = false;
              this.onCloseInstance();
            })
          );
        })
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.mesureComp.setMapInstance(this.map);
    this.mesureComp.initialise_mesure();
  }


  updateNullFieldValue(pte) {
    let properties: FeatureProperties[] =
      Object.values(pte.feature.getProperties()) as FeatureProperties[];
    for (let i=0; i < Object.keys(properties).length; i++) {
      if (!properties[i].value || properties[i].value == '' || properties[i].value == 'NULL') {
        properties[i].value = null;
      }
    }
    return properties;
  }


  ngOnChanges(changes: SimpleChanges): void {
    //Called before any other lifecycle hook. Use it to inject dependencies, but avoid any serious work here.
    //Add '${implements OnChanges}' to the class.
    if (changes["layersToDigitalise"]) {
      if (this.layersToDigitalise) {
        this.onInitInstance();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  ngAfterViewInit(): void {
    //Called after ngAfterContentInit when the component's view has been initialized. Applies to components only.
    //Add 'implements AfterViewInit' to the class.
    let zooms = new Zoom({
      target: "zoomsDigitaliser",
      zoomInLabel: document.getElementById("zoomIn"),
      zoomOutLabel: document.getElementById("zoomOut"),
      zoomInTipLabel: this.translate.instant('map.edit.zoom_plus'),
      zoomOutTipLabel: this.translate.instant('map.edit.zoom_out'),
    });
    zooms.setMap(this.map);
    this.map.updateSize();
  }

  transformFeaturesForWfs(
    pte: {
      feature: Feature<Geometry>;
      layerToDigitalise: LayerToDigitalise;
    },
    proj: Projection,
    isNewFeature?: boolean
  ) {
    let properties: FeatureProperties[] =
      pte.feature.getProperties() as FeatureProperties[];

    let newFeature = new Feature({
      geometry: pte.feature.getGeometry().clone(),
    });
    
    let validProperties = {};
    Object.keys(properties).forEach((key) => {
      if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
        validProperties[key] = properties[key];
      } else if (!(properties[key] instanceof Geometry)) {
            validProperties[properties[key].alias_de] = properties[key].value;          
      }
    });
  
    if (isNewFeature) {
      // newFeature.setProperties(validProperties);
      newFeature.setProperties({})
    } else {
      let formatedProperties = {};
      Object.values(properties)
        .filter((p) => p.name)
        .filter((p) => p.name != this.layersToDigitalise[0].fieldId)
        .map((p) => {
          Object.assign(formatedProperties, {
            [p.name]: p.value,
          });
        });
      newFeature.setProperties(formatedProperties);
    }
    newFeature.setId(pte.feature.getId());
    newFeature.getGeometry().transform("EPSG:3857", proj.getCode());
    return newFeature;
  }
}



export function fromOpenlayerEvent<T>(
  element: VectorSource<Geometry>,
  eventName: string
): Observable<T> {
  return new Observable((observer: Subscriber<T>) => {
    const handler = (e: T) => observer.next(e);

    let eventKey = element.on(eventName as any, handler as any);
    return () => {
      unByKey(eventKey);
    };
  });
}

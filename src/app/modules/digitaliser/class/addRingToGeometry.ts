import { TemplateRef, ViewContainerRef } from "@angular/core";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Collection, Map } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry, MultiPoint } from "ol/geom";
import { Draw, Snap } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Fill, Stroke, Style } from "ol/style";
import {
  EMPTY,
  from,
  fromEvent,
  Observable,
  ReplaySubject,
  Subject,
} from "rxjs";
import {
  catchError,
  filter,
  map as mapRxjs,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import {
  booleanContains,
  booleanIsvalid,
  differenceBetweenGeometry,
  getAllPointsOfPolygon,
  getLayerFromFeature,
} from "src/app/data/utils/geo";
import { handleDataHelper } from "src/app/data/utils/handleData";
import {
  CircleStyle,
  Feature,
  MultiPolygon,
  Point,
  Polygon,
  VectorLayer,
  VectorSource,
} from "src/app/ol-module";
import {
  FeatureStatus,
  LayerToDigitalise,
} from "../../../data/models/layer-to-digitalise";
import { LoadComponentService } from "src/app/data/services/load-component.service";
import {
  ChooseLayerToAddComponent,
  LayerToAddChoose,
} from "../modal/choose-layer-to-add/choose-layer-to-add.component";
import { addFeature, updateGeometryFeature } from "./featureCrud";
import { fromOpenlayerEvent } from "./updateAttributes";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

export class AddRingToGeometry {
  private chooseLayerToAdd_: () => Observable<LayerToAddChoose>;
  public onChangeLayerToAddInstance: () => void;
  layerToAdd: LayerToAddChoose;

  drawInteraction: Draw;
  snapInteraction: Snap;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  isEnable: boolean = false;

  constructor(
    public map: Map,
    public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
    public layersToDigitalise: Array<LayerToDigitalise>,
    public viewContainerRef: ViewContainerRef,
    public loadComponentService: LoadComponentService,
    public notifier: NotifierService,
    public dialog: MatDialog,
    // public sites_id: number,
    public customNotificationTmpl: TemplateRef<HTMLElement>,
    public translate: TranslateService
  ) {
    this.isEnable = false;

    this.snapInteraction = new Snap({
      pixelTolerance: 12,
      vertex: false,
      features: new Collection([]),
    });

    this.onChangeLayerToAddInstance = () => {
      this.destroyed$.next(true);
      this.destroyed$.complete();
      this.destroyed$ = new ReplaySubject(1);

      let defaultConfig: NotifierConfig = JSON.parse(
        JSON.stringify(this.notifier.getConfig())
      );
      this.notifier.getConfig().position.vertical.position = "top";
      this.notifier.getConfig().position.vertical.distance = 40;
      this.notifier.getConfig().position.horizontal.distance = 150;
      this.notifier.getConfig().behaviour.showDismissButton = false;
      this.notifier.hide("AddRingToGeometry_NOTIFICATION_ID");
      this.notifier.show({
        id: "AddRingToGeometry_NOTIFICATION_ID",
        template: this.customNotificationTmpl,
        message: this.translate.instant('map.edit.add_ring_msg'),
        type: "default",
      });
      window.setTimeout(() => {
        this.notifier.hide("AddRingToGeometry_NOTIFICATION_ID");
      }, 10000);
      window.setTimeout(() => {
        this.notifier.getConfig().position.vertical.position =
          defaultConfig.position.vertical.position;
        this.notifier.getConfig().position.vertical.distance =
          defaultConfig.position.vertical.distance;
        this.notifier.getConfig().position.horizontal.distance;
        this.notifier.getConfig().behaviour.showDismissButton =
          defaultConfig.behaviour.showDismissButton;
      }, 1000);

    //   this.layerToAdd = layerToAddChoose;
      if (this.drawInteraction) {
        this.map.removeInteraction(this.drawInteraction);
        this.map.removeInteraction(this.snapInteraction);
      }

      this.drawInteraction = new Draw({
        features: new Collection(),
        type: "Polygon",
        style: (feature: Feature) => {
          let geometryOnModify = feature.getGeometry();
          if (
            geometryOnModify instanceof MultiPoint ||
            geometryOnModify instanceof Point
          ) {
            return new Style({
              image: new CircleStyle({
                radius: 4,
                stroke: new Stroke({ color: "rgba(255,0,0,0.4)", width: 6 }),
                fill: new Fill({
                  color: "rgba(0,0,0,0.7)",
                }),
              }),
              zIndex: 1000001,
            });
          } else if (
            geometryOnModify instanceof MultiPolygon ||
            geometryOnModify instanceof Polygon
          ) {
            return [
              new Style({
                fill: new Fill({
                  color: "rgba(255,0,0,0.4)",
                }),
                stroke: new Stroke({ color: "rgba(0,0,0,0.4)" }),
                zIndex: 1000,
              }),
              new Style({
                image: new CircleStyle({
                  radius: 4,
                  stroke: new Stroke({ color: "rgba(255,0,0,0.4)", width: 6 }),
                  fill: new Fill({
                    color: "rgba(0,0,0,0.7)",
                  }),
                }),
                geometry: function (feature: Feature<Polygon>) {
                  let coordinates: Array<Coordinate> = getAllPointsOfPolygon(
                    feature.getGeometry()
                  );
                  return new MultiPoint(coordinates);
                },
                zIndex: 1000,
              }),
            ];
          }
          return null;
        },
      });

      fromOpenlayerEvent<DrawEvent>(this.drawInteraction, "drawend")
        .pipe(
          takeUntil(this.destroyed$),
          mapRxjs((event) => {
            let feature = event.feature;
            if (feature.getGeometry()) {
              if (!booleanIsvalid(feature.getGeometry())) {
                this.notifier.notify("error", this.translate.instant('map.edit.topological_error'));
                this.drawInteraction.abortDrawing();
                return undefined;
              } else {
                return feature;
              }
            }
            return feature;
          }),
          filter((feature) => feature != undefined),
          mapRxjs((feature) => {
            let geometry: any = feature.getGeometry();
            if (geometry.getType() == "Polygon"|| "MultiPolygon") {
              let i = 0;
              let features_to_control = this.editableLayers.map((layer) => {
                return layer
                  .getSource()
                  .getFeatures()
                  .slice()
                  .filter(
                    (featue) =>
                      featue.getGeometry().getType() == "Polygon" ||
                      "MultiPolygon"
                  )
                  .filter((feature) => {
                    let FMAPfeatures: Array<FeatureStatus> = layer
                      .getSource()
                      .get("FMAPfeatures");
                    return FMAPfeatures.find(
                      (ff) => ff.id === feature.getId() && !ff.deleted
                    );
                  });
              });

              let allFeatures: Array<Feature<Polygon | MultiPolygon>> =
                [].concat.apply([], features_to_control);

              let featuresThatContainsGeometry: Array<
                Feature<Polygon | MultiPolygon>
              > = [];
              while (i < allFeatures.length) {
                if (booleanContains(allFeatures[i].getGeometry(), geometry)) {
                  featuresThatContainsGeometry.push(allFeatures[i]);
                  if (featuresThatContainsGeometry.length > 1) {
                    this.notifier.notify(
                      "error",
                      this.translate.instant('map.edit.multiple_geometrie_overlapping_error')
                    );
                    break;
                  }
                }
                i++;
              }
              if (featuresThatContainsGeometry.length == 0) {
                this.notifier.notify(
                  "error",
                  this.translate.instant('map.edit.ring_must_be_in_polygon')
                );
              } else if (featuresThatContainsGeometry.length == 1) {
                let newGeometry = differenceBetweenGeometry(
                  featuresThatContainsGeometry[0].getGeometry(),
                  geometry
                );
                if (!newGeometry) {
                  this.notifier.notify(
                    "error",
                    this.translate.instant('map.edit.ring_cant_be_add')
                  );
                } else {
                  featuresThatContainsGeometry[0].setGeometry(newGeometry);
                  updateGeometryFeature(
                    getLayerFromFeature(
                      this.map,
                      featuresThatContainsGeometry[0]
                    ),
                    featuresThatContainsGeometry[0]
                  );

                  return geometry;
                }
              }
            }
            return undefined;
          }),
          filter((value) => !!value),
          tap((geometry: Polygon | MultiPolygon) => {
            let newFeature = new Feature<Polygon | MultiPolygon>();
            newFeature.setGeometry(geometry);

            // newFeature.set("alias", layerToAddChoose.alias);
            let id = handleDataHelper.makeid();
            let layerToDigitalise = this.layersToDigitalise[0]
            while (
              layerToDigitalise.layer
                .getSource()
                .getFeatures()
                .map((feat) => feat.getId())
                .indexOf(id) != -1
            ) {
              let id = handleDataHelper.makeid();
            }

            newFeature.setId(id);
            // newFeature.set('sites_id',this.sites_id)

            layerToDigitalise.layer.getSource().addFeature(newFeature);

            addFeature(layerToDigitalise.layer, newFeature);

            this.loadFeatureInSnap_();

            from(this.loadComponentService.loadComponent(this.viewContainerRef))
              .pipe(
                take(1),
                catchError(() => {
                  return EMPTY;
                }),
                switchMap((component) => {
                  component.instance.feature = newFeature;
                  component.instance.layerToDigitalise = layerToDigitalise;
                  component.instance.map = this.map;
                  component.instance.close = new Subject<boolean>();
                  return component.instance.close.pipe(
                    mapRxjs((response) => {
                      return { response: response, component: component };
                    })
                  );
                }),
                mapRxjs((response) => {
                  response.component.destroy();
                  setTimeout(() => {
                    this.map.updateSize();
                  }, 500);
                  setTimeout(() => {
                    this.map.updateSize();
                  }, 1000);
                })
              )
              .subscribe();
          }),
          catchError(() => {
            this.notifier.notify("error", this.translate.instant('map.edit.error_ading_ring'));
            return EMPTY;
          })
        )
        .subscribe();

      this.map.addInteraction(this.drawInteraction);
      this.map.addInteraction(this.snapInteraction);
    };

    this.chooseLayerToAdd_ = () => {
      let layersToAddChoose: LayerToAddChoose[] = this.layersToDigitalise
        .filter(
          (layerToDigitalise) =>
            layerToDigitalise.typologie.toLowerCase() == "polygon" ||
            layerToDigitalise.typologie.toLowerCase() == "multipolygon"
        )
        .map((layerToDigitalise) => {
          let geometryType: string = layerToDigitalise.typologie;

          return layerToDigitalise.legend.value.map((legend) => {
            let layerToAddChoose: LayerToAddChoose = Object.assign(
              {
                geometryType: geometryType,
                layer_id: layerToDigitalise.layer_id,
              },
              legend
            );

            return layerToAddChoose;
          });
        })
        .reduce((acc, val) => acc.concat(val), []);

      return this.dialog
        .open<ChooseLayerToAddComponent, LayerToAddChoose[], LayerToAddChoose>(
          ChooseLayerToAddComponent,
          { data: layersToAddChoose, panelClass: "panelWithNoPadding" }
        )
        .afterClosed();
    };
  }

  /**
   * enable operation
   */
  public enable() {
    this.isEnable = true;
    this.destroyed$ = new ReplaySubject(1);
    this.onChangeLayerToAddInstance();

    this.loadFeatureInSnap_();

    fromEvent<KeyboardEvent>(window, "keydown")
      .pipe(
        takeUntil(this.destroyed$),
        filter((event) => ["Backspace", "Escape"].includes(event.key)),
        filter(() => this.drawInteraction != undefined),
        tap((event) => {
          if (event.key == "Backspace") {
            this.drawInteraction.removeLastPoint();
          } else if (event.key == "Escape") {
            this.drawInteraction.abortDrawing();
          }
        })
      )
      .subscribe();
  }

  /**
   * disable operation
   */
  public disable() {
    this.notifier.hide("AddRingToGeometry_NOTIFICATION_ID");
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.map.removeInteraction(this.snapInteraction);
      this.snapInteraction.dispose();
    }

    this.layerToAdd = undefined;
    this.viewContainerRef.clear();

    this.destroyed$.next(true);
    this.destroyed$.complete();

    this.isEnable = false;
  }

  private loadFeatureInSnap_() {
    this.snapInteraction.dispose();
    this.editableLayers.map((layer) => {
      layer
        .getSource()
        .getFeatures()
        .slice()
        .filter((feature) => {
          let FMAPfeatures: Array<FeatureStatus> = layer
            .getSource()
            .get("FMAPfeatures");
          return FMAPfeatures.find(
            (ff) => ff.id === feature.getId() && !ff.deleted
          );
        })
        .map((feature) => {
          this.snapInteraction.addFeature(feature);
        });
    });
  }
}

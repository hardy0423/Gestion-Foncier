import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NotifierService } from "angular-notifier";
import {
  AttributionControl,
  LngLatLike,
  Map,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
} from "maplibre-gl";
import {
  catchError,
  combineLatest,
  concat,
  EMPTY,
  filter,
  forkJoin,
  map,
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
  switchMap,
  take,
  takeUntil,
  tap,
  toArray,
} from "rxjs";
import {
  Group,
  GroupWithLayers,
  Layer,
  rightMenuInterface,
  VectorProvider,
} from "src/app/data/models/type";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import { MapsService } from "src/app/data/services/maps.service";
import { StoreService } from "src/app/data/store/store.service";
import { MapLibreEvent } from "src/app/data/utils/maplibreEvent";
import { environment } from "src/environments/environment";

import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";
import { MatDrawer, MatDrawerContainer } from "@angular/material/sidenav";
import { TranslateService } from "@ngx-translate/core";
import { bbox, bboxPolygon, buffer, point, toMercator } from "@turf/turf";
import { Feature, FeatureCollection } from "geojson";
import { ParametersService } from "src/app/data/services/parameters.service";
import { UserService } from "src/app/data/services/user.service";
import { VectorProviderService } from "src/app/data/services/vector-provider.service";
import {
  CartoHelper,
  CatalogueLayer,
  layersInMap,
  listWmsCouche$,
} from "src/app/data/utils/cartoHelper";
import { LayerSwitcherComponent } from "src/app/shared/pages/layer-switcher/layer-switcher.component";
import {
  DescriptiveSheetComponent,
  DescriptiveSheetData,
} from "../descriptive-sheet/descriptive-sheet.component";
import MeasuresControl from 'src/app/data/utils/maplibremeasures';
import { GpsComponent, GpsData } from "../gps/gps.component";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Clipboard } from '@angular/cdk/clipboard';
import { Coordinate, toStringHDMS } from "ol/coordinate";
import { toLonLat, transform} from 'ol/proj';
import { BackendApiService } from "src/app/data/services/backend-api.service";
import { AppInjector } from "src/helper/app-injector.helper";
import { Elevation } from "src/app/data/utils/elevation";
import { FullscreenService } from "src/app/data/services/fullscreen.service";

export interface ElevationProperties {
  altitude: number;
  ID: number;
}

@Component({
  selector: "app-map",
  templateUrl: "./map.component.html",
  styleUrls: ["./map.component.scss"],
})

export class MapComponent implements OnInit {
  onInitInstance: () => void;

  /** Check if the loading is showed */
  showLoading: boolean = true;

  elevationChecked: boolean = false;
  popupElevation: Popup = new Popup({
    closeButton: false,
    closeOnClick: true,
    className: "map-popup-elevation",
  });
  hoveredStateId: string | number;

  form: FormGroup = this.fb.group({});

  groups$: Observable<Array<GroupWithLayers>>;
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  layersInToc: Array<layersInMap> = [];
  backendApiService: BackendApiService = AppInjector.get(BackendApiService);

  /**
   * All menu of the rith sidenav
   */
  ritghtMenus: Array<rightMenuInterface> = [
    {
      name: "toc",
      active: false,
      enable: true,
      tooltip: "toolpit_toc",
      title: "table_of_contents",
    },
    {
      name: "edition",
      active: false,
      enable: false,
      tooltip: "toolpit_tools",
      title: "tools",
    },
    {
      name: "routing",
      active: false,
      enable: false,
      tooltip: "toolpit_map_routing",
      title: "map_routing",
    },
    {
      name: "legend",
      active: false,
      enable: true,
      tooltip: "toolpit_legend",
      title: "legend",
    },
  ];

  /** The map */
  map: Map;

  /**
   * The intial center of the map
   */
  mapCenter: LngLatLike = [7.52047, 47.60025];

  /**
   * The inital map zoom
   */
  mapZoom: number = 13.64;

  /**
   * Map scale control
   */
  scale = new ScaleControl({
    maxWidth: 80,
    unit: "metric",
  });

  /**
   * Coordinates of the map
   */
  mousseCoordinates: { x: number; y: number; toText: () => string } = {
    x: null,
    y: null,
    toText: function () {
      if (this.x != null && this.y != null) {
        return this.x.toFixed(6) + "," + this.y.toFixed(6);
      }
      return "";
    },
  };

  attributionControl = new AttributionControl({
    compact: false,
    customAttribution: this.mousseCoordinates.toText(),
  });

  showButtons: boolean = false;
  isButtonLoaded: boolean = false;
  elevationLoaded:boolean = false;

  /**
   * La sidenav
   */
  @ViewChild(MatDrawerContainer, { static: true })
  sidenavContainer: MatDrawerContainer;

  @ViewChild(LayerSwitcherComponent, { static: true })
  layerSwitcherComponent: LayerSwitcherComponent;

  @ViewChild("drawer", { static: true }) set drawer_(drawer_: MatDrawer) {
    drawer_.opened = true
    this.parametersService.toolTipText = "close"; 
    drawer_.closedStart
    .pipe(
      takeUntil(this.destroyed$),
      tap(() => {
        this.parametersService.toolTipText = "open";
        this.parametersService.setSidenav(drawer_);
      })
    )
    .subscribe();

    drawer_.openedChange
      .pipe(
        takeUntil(this.destroyed$),
        tap(() => {
          this.parametersService.setSidenav(drawer_);
          this.layerSwitcherComponent.left = drawer_._getWidth() + 10 + "px";
        })
      )
      .subscribe();
  }
  /** the map container */
  @ViewChild("mapContainer") set mapContainer(mapContainer: ElementRef) {
    this.map = new Map({
      container: mapContainer.nativeElement,
      style: environment.maptilerStyle + environment.maptilerKey,
      center: this.mapCenter,
      zoom: this.mapZoom,
      attributionControl: false,
      trackResize: true,
      transformRequest: (url, resourceType) => {
        if (url.startsWith(environment.backendUrl)) {
          return {
            url: url,
            headers: {
              Authorization: "Bearer " + localStorage.getItem("token"),
            },
          };
        }
        return null;
      },
    });
    this.map.doubleClickZoom.disable();
    let cartoHelper =  new CartoHelper(this.map)
    let elevation =  new Elevation(this.map)
    let mapLibreEvent = new MapLibreEvent();
    merge(
      mapLibreEvent.fromMapLibreEvent(this.map, "load"),
      mapLibreEvent.fromMapLibreEvent(this.map, "moveend"),
      listWmsCouche$
    )
      .pipe(
        tap(() => {
          listWmsCouche$.getValue().map((couche) => {
            cartoHelper.addOrReloadWms(couche);
          });
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe((res)=>{
        this.elevationLoaded = false;
        this.map.on('load', () => {
          //add elevation layer
          if(this.map.getSource("elevation_maplibre_source") == undefined){
            elevation.addElevationLayer();
          }
          //add elevation layer
          if(this.map.getSource("contour_maplibre_source") == undefined){
            elevation.addContourLayer();
          }

          // Check loading status whenever a source data is loaded
          this.map.on('sourcedata', (event) => {
            if (event.isSourceLoaded) {
              this.checkLoadingStatus();
            }
          });
        })
      });

    this.cdRef.detectChanges();
    mapLibreEvent
      .fromMapLibreEvent(this.map, "click")
      .pipe(
        switchMap((e) => {
          return cartoHelper.mapHasCliked(e).pipe(
            switchMap((res) => {
              let sheetDatas: DescriptiveSheetData [] = [];
              sheetDatas = res.map((result) => {
                let couche = result.data.layers[0].metadata as CatalogueLayer;
                let sheetData: DescriptiveSheetData = {
                  type:
                    couche.descriptionSheetCapabilities === "osm"
                      ? "osm"
                      : "custom",
                  coordinates_3857: result.data.coord,
                  bbox_3857: result.data.bbox,
                  layer_id: couche.properties.couche_id,
                  map: this.map,
                  feature: result.data.feature,
                  layer: result.data.layers[0],
                  couche: result.data.couche
                };
                return sheetData;
              });

              let position = {
                top: "60px",
                left:
                  window.innerWidth < 500
                    ? "0px"
                    : window.innerWidth / 2 - 400 / 2 + "px",
              };
              for (
                let index = 0;
                index < this.dialog.openDialogs.length;
                index++
              ) {
                const elementDialog = this.dialog.openDialogs[index];

                if (
                  elementDialog.componentInstance instanceof
                  DescriptiveSheetComponent &&
                  document.getElementById(elementDialog.id) &&
                  document.getElementById(elementDialog.id).parentElement
                ) {
                  position.top =
                    document
                      .getElementById(elementDialog.id)
                      .parentElement.getBoundingClientRect().top + "px";
                  position.left =
                    document
                      .getElementById(elementDialog.id)
                      .parentElement.getBoundingClientRect().left + "px";
                }
              }

              this.destroyAllModalOfMap();

              let proprietes: MatDialogConfig = {
                disableClose: false,
                minWidth: 500,
                maxHeight: 460,
                width: "500ox",
                data: sheetDatas,
                hasBackdrop: false,
                autoFocus: false,
                position: position,
              };
              if (sheetDatas.length > 0) {
                return this.dialog
                  .open(DescriptiveSheetComponent, proprietes)
                  .afterClosed()
                  .pipe(takeUntil(this.destroyed$));
              }

              return EMPTY;
            })
          );
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    mapLibreEvent
      .fromMapLibreEvent(this.map, "mousemove")
      .pipe(
        takeUntil(this.destroyed$),
        tap((e) => {
          try {
            this.mousseCoordinates.x = e.lngLat.lng;
            this.mousseCoordinates.y = e.lngLat.lat;
            this.attributionControl.options.customAttribution =
              this.mousseCoordinates.toText() + " | EPSG:4326 " ;
            this.attributionControl._updateAttributions();
          } catch (error) { }
        })
      )
      .subscribe();

    mapLibreEvent
      .fromMapLibreEvent(this.map, "idle")
      .pipe(
        tap(() => {
          this.showLoading = true;
          this.layersInToc = new CartoHelper(this.map)
            .getAllLayersInToc()
            .filter((layerProp) => layerProp.type_layer == "geosmCatalogue")
            .filter((layerProp, index, self) => {
              /**
               * unique layer ^^
               */
              return (
                self
                  .map(
                    (item) =>
                      item.properties.couche_id + item.properties["type"]
                  )
                  .indexOf(
                    layerProp.properties.couche_id +
                    layerProp.properties["type"]
                  ) === index
              );
            });
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    // when there are shared layers
    combineLatest([
      mapLibreEvent.fromMapLibreEvent(this.map, "load"),
      this.groups$,
      this.activatedRoute.queryParams,
    ])
      .pipe(
        take(1),
        tap(() => {
          let navigationControl = new NavigationControl({
            showZoom: false,
          });
          let measure = new MeasuresControl({});
          this.map.addControl(this.attributionControl, "bottom-right")
            .addControl(this.scale, "bottom-right")
            .addControl(navigationControl, "bottom-right")
            .addControl(measure, "bottom-right");

          // Hide right buttons
          let groupButton = document.getElementsByClassName(
            'maplibregl-ctrl mapboxgl-ctrl maplibregl-measures maplibregl-ctrl-group mapboxgl-ctrl-group'
          ) as HTMLCollectionOf<HTMLElement>;
          if (groupButton.length > 0) {
            groupButton[0].style.display = 'none';
          }
          this.isButtonLoaded = true;
        }),
        filter(([evt, groups, parameters]) => {
          return (
            parameters["layers"] || parameters["pos"] || parameters["feat"]
          );
        }),
        switchMap(([evt, groups, parameters]) => {
          let cartoHelper = new CartoHelper(this.map);
          if (parameters["pos"]) {
            try {
              let positionData = parameters["pos"]
                .split(",")
                .map((u) => parseFloat(u));
              let shareCenter: LngLatLike = [positionData[0], positionData[1]];
              let zoom: number = positionData[2];
              cartoHelper.flyTo(shareCenter, zoom);
            } catch (error) {
              cartoHelper.flyTo(this.mapCenter, this.mapZoom);
            }
          }
          if (parameters["layers"]) {
            let isOldShare: boolean = false;
            parameters["layers"].split(";").map((item: string) =>
              item.split(",").map((u) => {
                if (u == "couche") {
                  isOldShare = true;
                }
              })
            );
            let getLayers$: Array<
              Observable<
                | {
                  layer: Layer;
                  group: Group;
                }
                | number
              >
            >;
            if (isOldShare) {
              let shareParameters: Array<[number, number]> = parameters[
                "layers"
              ]
                .split(";")
                .map((item: string) =>
                  item
                    .split(",")
                    .filter((u) => u != "couche")
                    .map((u) => parseInt(u))
                );
              getLayers$ = shareParameters.map((shareParam) => {
                return this.mapService.getLayerByOldId(shareParam[0]).pipe(
                  catchError((error: HttpErrorResponse) => {
                    return EMPTY;
                  })
                );
              });
            } else {
              let shareParameters: Array<[string, string, string]> = parameters[
                "layers"
              ]
                .split(";")
                .map((item) => item.split(",").map((u) => u));
              getLayers$ = shareParameters.map((shareParam) => {
                if (
                  shareParam[2] == "layer" &&
                  groups.find(
                    (group) => group.group_id === parseInt(shareParam[1])
                  ) != undefined
                ) {
                  let group = groups.find(
                    (group) => group.group_id === parseInt(shareParam[1])
                  );
                  return this.mapService.getLayer(parseInt(shareParam[0])).pipe(
                    catchError((error: HttpErrorResponse) => {
                      return EMPTY;
                    }),
                    map((layer) => {
                      return {
                        layer: layer,
                        group: group,
                      };
                    })
                  );
                } else if (shareParam[2] == "map") {
                  return of(parseInt(shareParam[0]));
                }
                return EMPTY;
              });
            }
            return concat(...getLayers$).pipe(toArray());
          }
          return EMPTY;
        }),
        switchMap((layer_groups) => {
          layer_groups.map((layer_group) => {
            if (typeof layer_group != "number") {
              this.geoData.addLayer(
                layer_group.layer,
                this.map,
                layer_group.group
              );
            }
          });
          return this.activatedRoute.queryParams.pipe(
            switchMap((params) => {
              let cartoHelper = new CartoHelper(this.map);
              if (params["feat"]) {
                let shareParameters: Array<string> = params["feat"].split(",");
                let layer_id = parseInt(shareParameters[0]);
                let provider_vector_id = parseInt(shareParameters[1]);
                let feat_id = shareParameters[2];
                return this.vectorProviderService
                  .getVectorProvider(provider_vector_id)
                  .pipe(
                    catchError((error: HttpErrorResponse) => {
                      return EMPTY;
                    }),
                    switchMap((vector_provider: VectorProvider) => {
                      let url =
                        environment.backendUrl +
                        "/api/provider/vector/sheet?map=" +
                        vector_provider.path_qgis;
                      url =
                        url +
                        "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=" +
                        vector_provider.id_server +
                        "&FEATUREID=" +
                        feat_id +
                        "&CRS=EPSG:3857&OUTPUTFORMAT=application/json";
                      // return layer
                      return this.http.get(url, { responseType: "text" }).pipe(
                        catchError(() => {
                          return EMPTY;
                        }),
                        tap((response: string) => {
                          let geojsonFeatures: Feature[] =
                            JSON.parse(response).features;
                          let bbox_3857 = bbox(
                            toMercator(bboxPolygon(geojsonFeatures[0].bbox))
                          );
                          let couche =
                            cartoHelper.getLayerByPropertiesCatalogue({
                              couche_id: layer_id,
                              type: "couche",
                            })[0].metadata as CatalogueLayer;

                          let sheetData: DescriptiveSheetData = {
                            type:
                              vector_provider.source === "osm"
                                ? "osm"
                                : "custom",
                            bbox_3857: params["bbox"],
                            layer_id: layer_id,
                            map: this.map,
                            couche: couche,
                          };

                          /**
                           * close all modal of type DescriptiveSheetComponent before open another
                           */
                          let position = {
                            top: "60px",
                            left:
                              window.innerWidth < 500
                                ? "0px"
                                : window.innerWidth / 2 - 400 / 2 + "px",
                          };
                          for (
                            let index = 0;
                            index < this.dialog.openDialogs.length;
                            index++
                          ) {
                            const elementDialog =
                              this.dialog.openDialogs[index];
                            if (
                              elementDialog.componentInstance instanceof
                              DescriptiveSheetComponent &&
                              document.getElementById(elementDialog.id) &&
                              document.getElementById(elementDialog.id)
                                .parentElement
                            ) {
                              position.top =
                                document
                                  .getElementById(elementDialog.id)
                                  .parentElement.getBoundingClientRect().top +
                                "px";
                              position.left =
                                document
                                  .getElementById(elementDialog.id)
                                  .parentElement.getBoundingClientRect().left +
                                "px";
                              elementDialog.close();
                            }
                          }

                          let proprietes: MatDialogConfig = {
                            disableClose: false,
                            minWidth: 500,
                            maxHeight: 460,
                            width: "500px",
                            data: [sheetData],
                            hasBackdrop: false,
                            autoFocus: false,
                            position: position,
                          };
                          this.dialog.open(
                            DescriptiveSheetComponent,
                            proprietes
                          );
                        })
                      );
                    })
                  );
              }
              return EMPTY;
            })
          );
        })
      )
      .subscribe();

    // when the user chooses to save the current layers
    combineLatest([
      mapLibreEvent.fromMapLibreEvent(this.map, "load"),
      this.groups$,
      this.activatedRoute.queryParams,
    ])
      .pipe(
        take(1),
        filter(([evt, groups, parameters]) => {
          return (
            !parameters["layers"] &&
            !parameters["pos"] &&
            !parameters["feat"] &&
            this.store.user.layers_saved &&
            localStorage.getItem("current_layers") != null &&
            localStorage.getItem("current_layers") != ""
          );
        }),
        switchMap(([evt, groups, parameters]) => {
          let getLayers$: Array<
            Observable<
              | {
                layer: Layer;
                group: Group;
              }
              | number
            >
          >;

          let shareValues = localStorage
            .getItem("current_layers")
            .toString()
            .split(";")
            .map((item) => item.split(",").map((u) => u));
          getLayers$ = shareValues.map((shareValue) => {
            if (
              shareValue[2] == "couche" &&
              groups.find(
                (group) => group.group_id === parseInt(shareValue[1])
              ) != undefined
            ) {
              let group = groups.find(
                (group) => group.group_id === parseInt(shareValue[1])
              );
              return this.mapService.getLayer(parseInt(shareValue[0])).pipe(
                catchError((error: HttpErrorResponse) => {
                  return EMPTY;
                }),
                map((layer) => {
                  return {
                    layer: layer,
                    group: group,
                  };
                })
              );
            } else if (shareValue[2] == "map") {
              return of(parseInt(shareValue[0]));
            }
            return EMPTY;
          });
          return concat(...getLayers$).pipe(toArray());
        }),
        switchMap((layer_groups) => {
          layer_groups.map((layer_group) => {
            if (typeof layer_group != "number") {
              this.geoData.addLayer(
                layer_group.layer,
                this.map,
                layer_group.group
              );
            }
          });
          return EMPTY;
        })
      )
      .subscribe();

    merge(
      mapLibreEvent.fromMapLibreEvent(this.map, "movestart"),
      mapLibreEvent.fromMapLibreEvent(this.map, "zoomstart")
    )
      .pipe(
        tap(() => {
          this.showLoading = true;
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    mapLibreEvent
      .fromMapLibreEvent(this.map, "idle")
      .pipe(
        tap((e) => {
          this.showLoading = false;
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    mapLibreEvent
    .fromMapLibreEvent(this.map, "dblclick")
    .pipe(
      takeUntil(this.destroyed$),
      switchMap((e) => {
        return elevation.mapHasClikedElevation(e).pipe(
          switchMap((res) => {
            try {
              this._snackBar.open('Lat: ' + e.lngLat.lat.toString() + ', Long: ' + e.lngLat.lng.toString() + ', Alt: ' + (res ? res.toString() + 'm' : '-'), this.translate.instant('copy'), {
                duration: 5*1000,
                panelClass: ['primary-snackbar']
              }).onAction().pipe(
                tap(() => {
                  this.clipboard.copy(e.lngLat.lat.toString() + ', ' + e.lngLat.lng.toString() + ', ' + res.toString())
                  this._snackBar.open(
                    this.translate.instant('map.coordinate_copied'), this.translate.instant('close'), {
                      duration: 5*1000,
                      panelClass: ['success-snackbar']
                    }
                  )
                  return EMPTY;
                }),
                takeUntil(this.destroyed$)
              ).subscribe()
            } catch (error) { }
            return EMPTY;
          })
        );
      }),
    )
    .subscribe();

    mapLibreEvent
      .fromMapLibreEvent(this.map, "mousemove", "countour_maplibre_layer")
      .pipe(
        takeUntil(this.destroyed$),
        tap((e) => {
          try {
            if(this.elevationChecked){
              const coordinates = e.lngLat;
              const description = e.features[0].properties as ElevationProperties;
              
              let content =`<span>${description.altitude} m</span>`;
              this.map.getCanvas().style.cursor = 'pointer';

              if (this.hoveredStateId) {
                this.map.setFeatureState(
                    {source: 'contour_maplibre_source', id: this.hoveredStateId},
                    {hover: false}
                );
              }
              this.hoveredStateId = e.features[0].properties['id'];
              if (this.hoveredStateId) {
                this.map.setFeatureState(
                  {source: 'contour_maplibre_source', id: this.hoveredStateId },
                  {hover: true}
                );
              }
              this.popupElevation.setLngLat(coordinates).setHTML(content).addTo(this.map);
            }
          } catch (error) { }
        })
      )
      .subscribe();

  mapLibreEvent
  .fromMapLibreEvent(this.map, "mouseleave", "countour_maplibre_layer")
  .pipe(
    takeUntil(this.destroyed$),
    tap((e) => {
      try {
        if(this.elevationChecked){
          this.map.getCanvas().style.cursor = '';
          if (this.hoveredStateId) {
            this.map.setFeatureState(
                {source: 'contour_maplibre_source', id: this.hoveredStateId},
                {hover: false}
            );
          }
          this.hoveredStateId = null;

        }
      } catch (error) { }
    })
  )
  .subscribe();
}

  getLayersInMap() {
    return this.layersInToc.filter(layer => layer.visible).map(
      (layerProp) => {
        let layer_info = {
          id: this.geoData.getLayerInMap(layerProp.properties.couche_id).layer.providers[0].id,
          layer_project : (layerProp.layer[0]?.metadata as CatalogueLayer).qgis_project,
        }
        return layer_info;
      });
  }

  /** The parameter to display left panel */
  displayPanel: boolean = true;

  dialogRef: MatDialogRef<GpsComponent>;
  gpsData: GpsData;
  marker: Marker = new Marker({color: "#2872c2"});

  isFullscreen = false;
  private fullscreenSubscription: Subscription;
  
  constructor(
    public fb: FormBuilder,
    public router: Router,
    public geoData: GeoDataService,
    public notifier: NotifierService,
    public mapService: MapsService,
    public translate: TranslateService,
    public dialog: MatDialog,
    public userService: UserService,
    private cdRef: ChangeDetectorRef,
    public activatedRoute: ActivatedRoute,
    public parametersService: ParametersService,
    public vectorProviderService: VectorProviderService,
    private http: HttpClient,
    public store: StoreService,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private fullscreenService: FullscreenService
    ) {
    this.form.addControl(
      "layers_saved",
      new FormControl(this.store.user.layers_saved)
    );

    this.form
      .get("layers_saved")
      .valueChanges.pipe(
        switchMap((value) => {
          const formData = new FormData();
          formData.append("layers_saved", value.toString());
          return this.userService.updateUser(formData, this.store.user.id).pipe(
            catchError((error) => {
              this.notifier.notify(
                "error",
                this.translate.instant(
                  "user.manage_users_dialog.error_changing_status_user"
                )
              );
              this.form.enable();
              return EMPTY;
            }),
            tap(() => {
              let user = this.store.user;
              user.layers_saved = value;
              this.store.user$.next(user);

              if (value) {
                let layers = [];
                this.layersInToc.forEach((element) => {
                  if (element != undefined) {
                    const layer =
                      element?.properties.couche_id +
                      "," +
                      element?.properties.group_id +
                      "," +
                      element?.properties.type;
                    layers.push(layer);
                  }
                });
                localStorage.setItem("current_layers", layers.join(";"));
              }
            })
          );
        })
      )
      .subscribe();

    this.parametersService.menuMapClicked$
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.sidenavContainer != undefined),
        tap(() => {
          if (!this.sidenavContainer.start.opened) {
            this.sidenavContainer.start.toggle();
          }
        })
      )
      .subscribe();

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    this.groups$ = combineLatest([this.activatedRoute.data, onInit]).pipe(
      switchMap((params) => {
        let profil = params[0]["profil"];
        let previous_profil = profil == 1 ? 2 : 1;

        // Make the first call to get the shared groups
        let shared$ = localStorage.getItem("current_layers") ?
          this.mapService.getGroupWithLayersByMap(Number(previous_profil)).pipe(
            catchError((error: HttpErrorResponse) => {
              this.notifier.notify(
                "error",
                this.translate.instant("map.error_loading_groups")
              );
              return EMPTY;
            }),
            map(groupsShared => this.removeGroupWithLayer(groupsShared))
          ) : of(null);
    
        // Make the call to get the groups for the current profile
        let groups$ = this.mapService.getGroupWithLayersByMap(profil).pipe(
          catchError((error: HttpErrorResponse) => {
            this.notifier.notify(
              "error",
              this.translate.instant("map.error_loading_groups")
            );
            return EMPTY;
          })
        );
    
        // Combine the results of the two calls
        return forkJoin([shared$, groups$]).pipe(
          map(([shared, groups]) => {
            shared = shared || []; // Convertit null en un tableau vide
            shared.forEach(group_shared => {
              groups.push(group_shared);
            });
            return groups;
          })
        );
      })
    );
  }

  removeGroupWithLayer(data: Array<GroupWithLayers>): Array<GroupWithLayers>{
    let result : Array<GroupWithLayers> = new Array<GroupWithLayers>();
    let tmp : Array<GroupWithLayers> = new Array<GroupWithLayers>();
    let shareValues = localStorage
      .getItem("current_layers")
      .toString()
      .split(";")
      .map((item) => item.split(",").map((u) => u));

      shareValues.map( array => {
        tmp = data.filter((group) => group.group_id == Number(array[1]));
        result = result.concat(tmp);
      });
      result = result.filter((valeur, index, self) => self.indexOf(valeur) === index);
      return result;
  }

  ngOnInit(): void {
    this.fullscreenSubscription = this.fullscreenService.fullscreen$.subscribe(isFullscreen => {
      this.sidenavContainer?.end?.close();
      this.ritghtMenus.map((item) => (item.active = false));
      this.showButtons = true;
      this.toogleRightButtons();
      this.isFullscreen = isFullscreen;
    });
    this.onInitInstance();
  }

  destroyAllModalOfMap() {
    for (let index = 0; index < this.dialog.openDialogs.length; index++) {
      const elementDialog = this.dialog.openDialogs[index];
      if (
        elementDialog.componentInstance instanceof DescriptiveSheetComponent &&
        document.getElementById(elementDialog.id) &&
        document.getElementById(elementDialog.id).parentElement
      ) {
        elementDialog.close();
      }
    }
  }

  /**
   * on destroy
   */
  ngOnDestroy(): void {
    if (this.fullscreenSubscription) {
      this.fullscreenSubscription.unsubscribe();
    }
    this.destroyAllModalOfMap();
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  /**
   * Get a menu from right menu
   * @param name string name of the menu
   * @return rightMenuInterface|undefined
   */
  getRightMenu(name: string): rightMenuInterface {
    return this.ritghtMenus.find((item) => item.name == name);
  }

  /**
   * Get the active right menu
   * @return rightMenuInterface
   */
  getRightMenuActive(): rightMenuInterface {
    return this.ritghtMenus.find((item) => item.active);
  }

  /**
   * Open right menu
   * @param name string
   */
  openRightMenu(name: string) {
    let menu = this.getRightMenu(name);
    if (menu.active) {
      this.sidenavContainer?.end?.close();
      this.ritghtMenus.map((item) => (item.active = false));
    } else {
      this.sidenavContainer?.end?.open();
      this.ritghtMenus.map((item) => (item.active = false));
      menu.active = true;
    }
  }

  openGpsDialog(): void { 
    this.gpsData = {
      latitude: null,
      longitude: null,
      map: this.map
    };

    let proprietes: MatDialogConfig = {
      minWidth: 500,
      maxHeight: 460,
      width: "150px",
      data: this.gpsData,
    };
    
    this.dialogRef = this.dialog.open(GpsComponent, proprietes); 

    this.dialogRef.afterClosed().subscribe(result => {
      if(this.gpsData.longitude && this.gpsData.latitude && result == "zoom" ){
        let lngLat2: Coordinate = [Number(this.gpsData.longitude), Number(this.gpsData.latitude)]; 
        let coordinate = transform(lngLat2, 'EPSG:4326', 'EPSG:3857');
        let coordinate2 = toLonLat(coordinate, 'EPSG:3857');
        let newLongLat : LngLatLike = {lng: coordinate2[0], lat: coordinate2[1]};
        let dms = toStringHDMS(coordinate2,3)
        let altitude: number;
        
        this.getAltitudeWithCoordinate(lngLat2).pipe().subscribe((res) => {
          altitude = res ? res : null;
        
          // Create a popup, but don't add it to the map yet.
          const popup = new Popup({
            closeButton: false,
            closeOnClick: true,
            offset: 24,
          });

          let content =`
          <table>
            <tbody>
              <tr>
                <td style="text-align: right;"><strong>Lat:</td>
                <td>${this.gpsData.latitude}</td>
              </tr>
              <tr>
                <td style="text-align: right;"><strong>Long:</td>
                <td>${this.gpsData.longitude}</td>
              </tr>
              <tr>
                <td style="text-align: right;"><strong>DMS:</td>
                <td>${dms}</td>
              </tr>
              <tr>
                <td style="text-align: right;"><strong>Alt:</td>
                <td>${altitude ? altitude + "m" : "-"}</td>
              </tr>
            </tbody>
          </table>
          `;

          popup.setHTML(content);
          this.marker.setLngLat(newLongLat);
          this.marker.setPopup(popup)
          this.marker.addTo(this.map)
          });
      }
    });
  }
  
  
  getAltitudeWithCoordinate(coordinate: Coordinate): Observable<number>{
    var mapCanvas = this.map.getCanvas();
      var mapBounds = this.map.getBounds();
      let qgis_file_project_elevation = environment.elevation_project_file;

      let mapWithInMeter =
        toMercator(
          point([mapBounds.getNorthEast().lng, mapBounds.getNorthEast().lat])
        ).geometry.coordinates[0] -
        toMercator(
          point([mapBounds.getNorthWest().lng, mapBounds.getNorthWest().lat])
        ).geometry.coordinates[0];

      let boundigBoxClick3857 = bbox(
        toMercator(
          buffer(
            point([coordinate[0], coordinate[1]]),
            mapWithInMeter / mapCanvas.width,
            { units: "kilometers" }
          )
        )
      );

      let url =
        environment.backendUrl +
        "/api/provider/vector/sheet" +
        "?MAP=" + qgis_file_project_elevation + 
        "&FEATURE_COUNT=3&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=geo_elevation" +
        "&QUERY_LAYERS=geo_elevation" +
        "&BBOX=" +
        boundigBoxClick3857.join(",") +
        "&CRS=EPSG:3857&INFO_FORMAT=application/json&I=50&J=50&WIDTH=101&HEIGHT=101&WITH_GEOMETRY=true";
  
      return concat(
          this.backendApiService
            .getFeatureInfoWMS<FeatureCollection>(url)
            .pipe(
              catchError(() => EMPTY)
            )
      ).pipe(
        toArray(),
        map((featureCollections) => {
          let features: Array<Feature> = [];
          let response: number = null;
  
          featureCollections.map((fc) => {
            features = features.concat(fc.features);
          });
  
          if (features[0].properties) {
            response = features[0].properties[0].value;
          }
          return response;
        })
      );
  }

  /**
   * Set visible of a layer contour
   */
  setVisibleOfContourLayer() {
    let popup = document.getElementsByClassName('maplibregl-popup mapboxgl-popup map-popup-elevation maplibregl-popup-anchor-bottom mapboxgl-popup-anchor-bottom')
    if (popup?.length > 0) {
      popup[0].remove();
    }
    this.elevationChecked = !this.elevationChecked;
    this.map.setPaintProperty("countour_maplibre_layer", "line-opacity", this.elevationChecked ? 1 : 0)
  }

  /**
   * Collapse right buttons
   */
  toogleRightButtons() {
    this.showButtons = !this.showButtons;

    let groupButton = document.getElementsByClassName(
      'maplibregl-ctrl mapboxgl-ctrl maplibregl-measures maplibregl-ctrl-group mapboxgl-ctrl-group'
    ) as HTMLCollectionOf<HTMLElement>;
    if (this.showButtons) {
      if (groupButton.length > 0) {
        groupButton[0].style.display = 'block';
      }
    } else {
      if (groupButton.length > 0) {
        groupButton[0].style.display = 'none';
      }
    }
  }

  /**
   * Check elevation loading status
   */
  checkLoadingStatus() {
    if (this.map.getSource('elevation_maplibre_source') && this.map.getSource('contour_maplibre_source') && this.map.isSourceLoaded("elevation_maplibre_source") && this.map.isSourceLoaded("contour_maplibre_source")) {
      this.elevationLoaded = true;
    }
  };
}

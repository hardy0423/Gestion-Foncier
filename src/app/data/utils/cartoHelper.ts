import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import SphericalMercator from "@mapbox/sphericalmercator";
import {
  bbox,
  BBox,
  bboxPolygon,
  buffer,
  point,
  toMercator,
  toWgs84,
} from "@turf/turf";
import { Feature, FeatureCollection } from "geojson";
import {
  ImageSource,
  LayerSpecification,
  LngLatBounds,
  LngLatBoundsLike,
  LngLatLike,
  Map,
  MapMouseEvent,
} from "maplibre-gl";
import { Coordinate } from "ol/coordinate";
import { BehaviorSubject, concat, EMPTY, merge, Observable, timer } from "rxjs";
import {
  catchError,
  delayWhen,
  map,
  retryWhen,
  take,
  tap,
  toArray,
} from "rxjs/operators";
import {
  CircleStyle,
  Cluster,
  Fill,
  Geometry,
  Stroke,
  Style,
  VectorLayer,
  VectorSource,
  Text,
  Icon,
  GeoJSON,
} from "src/app/ol-module";
import { environment } from "src/environments/environment";
import { AppInjector } from "src/helper/app-injector.helper";
import { CategoryStyle, GeometryTypeProvider } from "../models/type";
import { BackendApiService } from "../services/backend-api.service";
import { StoreService } from "../store/store.service";
import { MapLibreEvent } from "./maplibreEvent";

export interface dataFromClickOnMapInterface {
  type: "vector" | "raster" | "clear";
  data: {
    coord: [number, number];
    bbox: BBox;
    layers: Array<LayerSpecification>;
    feature?: Array<Feature>;
    couche: CatalogueLayer;
    /** additional data */
    data?: {};
  };
}

/**
 * Interface of the table of contents capabilities
 */
export interface tocCapabilitiesInterface {
  /**
   * Can change opactity ?
   */
  opacity: boolean;
  /**
   * have metadata ?
   */
  metadata: boolean;
  /**
   * Can be shared ?
   */
  share: boolean;
  /**
   * Can be automatically remove when the user wnant to clear the map ?
   */
  removable: boolean;
}

/**
 * Interface of the legend capabilities
 */
export interface legendCapabilitiesInterface {
  /**
   * url of the img icon
   */
  urlImg?: string;
  /**
   * use legend from the carto server
   */
  useCartoServer?: boolean;
  description: string;
}

/**
 * Interface of all layers in the map
 */
export interface layersInMap {
  nom: string;
  type_layer:
    | "geosmCatalogue"
    | "draw"
    | "mesure"
    | "mappilary"
    | "exportData"
    | "other"
    | "routing";
  image: string;
  properties: {
    group_id: number;
    couche_id: number;
    type: "couche" | "carte";
  };
  zIndex: number;
  visible: boolean;
  data: any;
  /**
   * text and background color of the badje in the table of contents
   */
  badge?: {
    text: string;
    bgColor: string;
  };
  /**
   * The layer type maplibre/layer in the map
   */
  layer: Array<LayerSpecification>;
  /**
   * capabilities of the layer in toc. They user can set opactiy ? read metadata ?...
   * By default, all is set to true
   */
  tocCapabilities: tocCapabilitiesInterface;
  /**
   * capabilities of the layer legend. how to display legend of the layer ? with the url of a image ? with the legend of the carto server ?
   * by default this is none => no legend to display
   */
  legendCapabilities?: legendCapabilitiesInterface[];
  /**
   * description sheet capabilities
   */
  descriptionSheetCapabilities: "osm" | "querry" | "sigfile";
  isToggle?: boolean;
}

const typeLayer = [
  "catalogue",
  "draw",
  "mesure",
  "mappilary",
  "exportData",
  "other",
  "routing",
];

/**
 * interface to construct  a layer
 */
export interface CatalogueLayer {
  nom: string;
  /**
   * data if type_layer === geojson
   */
  data_geojson?: any;
  /**
   * is the layer should appear in the toc ?
   */
  inToc?: boolean;
  type_layer?:
    | "geosmCatalogue"
    | "draw"
    | "mesure"
    | "mappilary"
    | "exportData"
    | "other"
    | "routing";
  type: "geojson" | "wfs" | "wms" | "xyz";
  crs?: string;
  visible?: boolean;
  strategy?: "bbox" | "all";
  /**
   * Is layer already add to map ?
   */
  load?: boolean;
  style?: any;
  maxzoom?: number;
  minzoom?: number;
  zindex?: number;
  size?: number;
  cluster?: boolean;
  icon?: string;
  iconImagette?: string;
  url?: string;
  identifiant?: string[];
  qgis_project?: string;
  styleWMS?: string[];
  geometryType: GeometryTypeProvider;
  /**
   * capabilities of the layer in toc. They user can set opactiy ? read metadata ?...
   * By default, all is set to true
   */
  tocCapabilities?: tocCapabilitiesInterface;
  /**
   * capabilities of the layer legend. how to display legend of the layer ? with the url of a image ? with the legend of the carto server ?
   * by default this is none => no legend to display
   */
  legendCapabilities?: legendCapabilitiesInterface[];
  properties?: {
    group_id: number;
    couche_id: number;
    style_id:number;
    type: "couche" | "carte";
  };
  descriptionSheetCapabilities?: "osm" | "querry" | "sigfile";
  /**
   * Read permission
   */
  canRead?: boolean
  /**
   * Write permission
   */
  canWrite?: boolean
  /**
   * Categorised style
   */
  categoryStyles?: {
    list:CategoryStyle[];
    toogled: boolean;
  }
}
/**
 * Get wms extent from map bounds
 * @param bounds LngLatBounds
 * @returns
 */
export function wmsExtent130FromBounds(bounds: LngLatBounds | any) {
  var sm = new SphericalMercator({
    size: 256,
  });
  return [
    ...sm.forward(bounds.getSouthWest().toArray()),
    ...sm.forward(bounds.getNorthEast().toArray()),
  ];
}

/**
 * Get extent coordinates from map bounds
 * @param bounds LngLatBounds
 * @returns
 */
export function getExtentCoordinatesFromBounds(bounds: LngLatBounds) {
  return [
    bounds.getNorthWest().toArray(),
    bounds.getNorthEast().toArray(),
    bounds.getSouthEast().toArray(),
    bounds.getSouthWest().toArray(),
  ];
}

export const listWmsCouche$: BehaviorSubject<Array<CatalogueLayer>> = new BehaviorSubject<
    Array<CatalogueLayer>
  >([]);

/**
 * Handle diverse operation in link with the map
 */
@Injectable()
export class CartoHelper {
  environment = environment;

 
  backendApiService: BackendApiService = AppInjector.get(BackendApiService);

  constructor(public map: Map) {

  }

  addOrReloadWms(couche: CatalogueLayer) {
    let source_name = couche.nom + "_maplibre_source";
    let layer_name = couche.nom + "_maplibre_layer";

    var mapCanvas = this.map.getCanvas();
    var mapBounds = this.map.getBounds();
    var imageCoordinates = getExtentCoordinatesFromBounds(mapBounds);
    var imageExtent3857 = wmsExtent130FromBounds(mapBounds);

    let wmsWidth = Math.floor(mapCanvas.width / window.devicePixelRatio);
    let wmsHeight = Math.floor(mapCanvas.height / window.devicePixelRatio);
    let urlWms =
      couche.url +
      "&FORMAT=image/png&SERVICE=WMS&VERSION=1.3.0&FORMAT_OPTIONS=dpi:180" +
      "&REQUEST=GetMap&CRS=EPSG:3857&TRANSPARENT=true&WIDTH=" +
      wmsWidth +
      "&HEIGHT=" +
      wmsHeight +
      "&LAYERS=" +
      couche.identifiant.join(",") +
      "&TILED=true&STYLE=" +
      couche.styleWMS.join(",") +
      "&BBOX=" +
      imageExtent3857.join(",");
      
    if(couche.categoryStyles?.list?.length>0){
      let category_id = couche.categoryStyles?.list?.map((option)=>option.id)
      urlWms=urlWms+"&category_id="+category_id+"&provider_style_id="+couche.properties.style_id
      // let filter:string = couche.categoryStyles?.list?.map((option)=> '"'+option.PropertyName+'" '+option.operator+" '"+option.Literal+"'" ).join(' or ')
      // urlWms=urlWms+"&FILTER="+couche.identifiant[0]+":"+filter
    }
  
    if (this.map.getSource(source_name) && this.map.getLayer(layer_name)) {
      let source = this.map.getSource(source_name);
      if (source instanceof ImageSource) {
        source.updateImage({
          url: urlWms,
          coordinates: imageCoordinates as any,
        });
      }
    }
  }

  fitBounds(extent: BBox) {
    let boundBoxWgs84 = bbox(toWgs84(bboxPolygon(extent))) as LngLatBoundsLike;
    this.map.fitBounds(boundBoxWgs84);
  }

  flyTo(center: LngLatLike, zoom: number) {
    this.map.flyTo({
      center: center,
      zoom: zoom,
      essential: true,
    });
    // takeUntil(this.destroyed$)
  }

  /**
   * Construct a layer with openlayers
   * @param couche geosmLayer the layer to construct
   * @return VectorLayer|ImageLayer the layer costructed
   */
  constructLayer(couche: CatalogueLayer): LayerSpecification {
    let source_name = couche.nom + "_maplibre_source";
    let layer_name = couche.nom + "_maplibre_layer";
    let layer: LayerSpecification;

    if (couche.type == "xyz") {
      this.map.addSource(source_name, {
        type: "raster",
        tiles: [couche.url],
        tileSize: 256,
        attribution:
          '<a target="_blank" href="https://www.openstreetmap.org/copyright"> © OpenStreetMap </a> contributors ',
      });

      layer = {
        id: layer_name,
        type: "raster",
        source: source_name,
        layout: {
          visibility: "none",
        },
        paint: {},
      };
      // this.map.addLayer(
      //     {
      //         'id': layer_name,
      //         'type': 'raster',
      //         'source': source_name,
      //         'layout': {
      //             'visibility': 'none',
      //         },
      //         'paint': {}
      //     }
      // )

      // return this.map.getLayer(layer_name)
      // this.map.removeLayer(layer_name)
      // return layer
    } else if (couche.type == "wms") {
      var mapCanvas = this.map.getCanvas();
      var mapBounds = this.map.getBounds();
      var imageCoordinates = getExtentCoordinatesFromBounds(mapBounds);
      var imageExtent3857 = wmsExtent130FromBounds(mapBounds);

      let wmsWidth = Math.floor(mapCanvas.width / window.devicePixelRatio);
      let wmsHeight = Math.floor(mapCanvas.height / window.devicePixelRatio);
      let urlWms =
        couche.url +
        "&FORMAT=image/png&SERVICE=WMS&VERSION=1.3.0&FORMAT_OPTIONS=dpi:180" +
        "&REQUEST=GetMap&CRS=EPSG:3857&TRANSPARENT=true&WIDTH=" +
        wmsWidth +
        "&HEIGHT=" +
        wmsHeight +
        "&LAYERS=" +
        couche.identifiant.join(",") +
        "&TILED=true&STYLE=" +
        couche.styleWMS.join(",") +
        "&BBOX=" +
        imageExtent3857.join(",");

      this.map.addSource(source_name, {
        type: "image",
        url: urlWms,
        coordinates: imageCoordinates as any,
      });

      layer = {
        id: layer_name,
        type: "raster",
        source: source_name,
        layout: {
          visibility: "none",
        },
        paint: {
          "raster-fade-duration": 0,
          "raster-opacity": 1,
        },
      };
    } else if (couche.type == "geojson") {
      let geometryLayerType:
        | "fill"
        | "line"
        | "symbol"
        | "circle"
        | "fill-extrusion";
      let layerPaint = {};
      if (couche.geometryType === "MultiLineString") {
        geometryLayerType = "line";
        layerPaint = {
          "line-color": "yellow",
          "line-width": 5,
        };
      } else if (couche.geometryType === "MultiPolygon") {
        geometryLayerType = "fill";
        layerPaint = {
          "fill-color": "yellow",
          "fill-outline-color": "red",
          "fill-opacity": 1,
        };
      }
      if (couche.geometryType === "MultiPoint") {
        geometryLayerType = "circle";
        layerPaint = {
          "circle-color": "yellow",
          "circle-radius": 20,
          "circle-stroke-color": "red",
          "circle-stroke-width": 3,
          "circle-opacity": 0.6,
        };
      }

      /**
       * @see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-cluster
       */
      this.map.addSource(source_name, {
        type: "geojson",
        cluster: couche.cluster,
        data: couche.data_geojson,
      });
      layer = {
        id: layer_name,
        type: geometryLayerType,
        source: source_name,
        layout: {},
        // 'filter': ['==', '$type', couche.geometryType],
        paint: layerPaint,
      };
    } else if (couche.type == "wfs") {
      let geometryLayerType:
        | "fill"
        | "line"
        | "symbol"
        | "circle"
        | "fill-extrusion";
      if (couche.geometryType === "MultiLineString") {
        geometryLayerType = "line";
      } else if (couche.geometryType === "MultiPolygon") {
        geometryLayerType = "fill";
      }
      if (couche.geometryType === "MultiPoint") {
        geometryLayerType = "circle";
      }

      var url =
        couche.url +
        "?" +
        "SERVICE=WFS&VERSION=1.1.0&REQUEST=GETFEATURE&outputFormat=GeoJSON&typeName=" +
        couche.identifiant.join(",");

      this.map.addSource(source_name, {
        type: "geojson",
        cluster: couche.cluster,
        data: url,
      });

      layer = {
        id: layer_name,
        type: geometryLayerType,
        source: source_name,
        layout: {
          visibility: "none",
        },

        paint: {},
      };
    }

    // this.setPropertiesToLayer(layer, couche)

    // if (couche.zindex) {
    //     this.map.getStyle().layers
    //     this.setZindexToLayer(layer, couche.zindex)
    // }

    // if (couche.minzoom && layer instanceof TileLayer == false) {
    //     layer.setMinResolution(this.map.getView().getResolutionForZoom(couche.minzoom))
    // }

    // if (couche.maxzoom) {
    //     layer.setMaxResolution(this.map.getView().getResolutionForZoom(couche.maxzoom))

    // }

    // layer.setVisible(couche.visible)

    return layer;
  }

  /**
   * Construct a layer with openlayers
   * @param couche geosmLayer the layer to construct
   * @return VectorLayer the layer costructed
   */
  constructOLayer(couche: CatalogueLayer): VectorLayer<VectorSource<Geometry>> {
    const image = new CircleStyle({
      radius: 15,
      fill: new Fill({
        color: "rgba(13, 88, 156, 0.5)",
      }),
      stroke: new Stroke({ color: "black", width: 2 }),
    });

    const styles = {
      Point: new Style({
        image: image,
      }),
      LineString: new Style({
        stroke: new Stroke({
          color: environment.primaryColor,
          width: 2,
        }),
      }),
      MultiLineString: new Style({
        stroke: new Stroke({
          color: environment.primaryColor,
          width: 2,
        }),
      }),
      MultiPoint: new Style({
        image: image,
      }),
      MultiPolygon: new Style({
        stroke: new Stroke({
          color: "black",
          width: 2,
        }),
        fill: new Fill({
          color: "rgba(13, 88, 156, 0.5)",
        }),
      }),
      Polygon: new Style({
        stroke: new Stroke({
          color: "blue",
          lineDash: [4],
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(13, 88, 156, 0.5)",
        }),
      }),
    };

    let layer: VectorLayer<VectorSource<Geometry>>;
    if (couche.type == "geojson") {
      var vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(couche.data_geojson, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        }),
      });

      layer = new VectorLayer({
        source: vectorSource,
        style: function (feature) {
          let FMAPfeatures = vectorSource.get('FMAPfeatures') ? vectorSource.get('FMAPfeatures') : []
          if (FMAPfeatures.filter((item) => item.id == feature.getId() && item.deleted == true).length > 0) {
            return null
          }
          return styles[feature.getGeometry().getType()];
        },
        /**
         * so that map.forEachLayerAtPixel work as expected
         * @see https://openlayers.org/en/latest/apidoc/module-ol_PluggableMap-PluggableMap.html#forEachLayerAtPixel
         */
        // className: couche.nom + "___" + couche.type_layer,
      });
    }

    // this.setPropertiesToLayer(layer, couche)

    // if (couche.zindex) {
    //   this.setZindexToLayer(layer, couche.zindex)
    // }

    // if (couche.minzoom && layer instanceof TileLayer == false) {
    //   layer.setMinResolution(this.map.getView().getResolutionForZoom(couche.minzoom))
    // }

    // if (couche.maxzoom) {
    //   layer.setMaxResolution(this.map.getView().getResolutionForZoom(couche.maxzoom))

    // }

    // layer.setVisible(couche.visible)

    return layer;
  }
  /**
   * Add layer to map
   * @param layerSpecification LayerSpecification
   * @param couche CatalogueLayer
   */
  addLayer(layerSpecification: LayerSpecification, couche: CatalogueLayer) {
    this.map.addLayer(layerSpecification);

    let layer = this.map.getLayer(layerSpecification.id);
    layer.setLayoutProperty("visibility", couche.visible ? "visible" : "none");
    layer.metadata = couche;

    if (couche.type === "wms") {
      var listWms = listWmsCouche$.getValue();
      if (
        listWms.filter(
          (wms) =>
            couche.nom + couche.identifiant + couche.url ===
            wms.nom + wms.identifiant + wms.url
        ).length === 0
      ) {
        listWms.push(couche);
        listWmsCouche$.next(listWms);
      }
    }
  }

  /**
   * Get list of layer by properties of geosm catalogue
   * @param properties {group_id: number,couche_id: number,type:'couche'|'carte'} properties geosm catalogue of layer to search
   * @param isLayerGroup boolean is the layeys we want are in a layergroup ?
   * @return Array<any>
   */
  getLayerByPropertiesCatalogue(properties: {
    group_id?: number;
    couche_id: number;
    type: "couche" | "carte";
  }): Array<LayerSpecification> {
    return this.map
      .getStyle()
      .layers.filter(
        (layerSpecification) =>
          layerSpecification.metadata != undefined &&
          layerSpecification.metadata["type_layer"] != undefined
      )
      .filter((layerSpecification) => {
        let couche: CatalogueLayer =
          layerSpecification.metadata as CatalogueLayer;
        if (properties.group_id) {
          return (
            couche.properties.type == properties.type &&
            couche.properties.group_id == properties.group_id &&
            couche.properties.couche_id == properties.couche_id
          );
        } else {
          return (
            couche.properties.type == properties.type &&
            couche.properties.couche_id == properties.couche_id
          );
        }
      });
  }

  /**
   * Get layer by  name
   * @param name string 'nom' of layer to search
   */
  getLayerByName(name: string) {
    return this.map.getLayer(name + "_maplibre_layer");
  }

  /**
   * Remove any type of layer in the map
   */
  removeLayerToMap(layer: LayerSpecification) {
    let couche: CatalogueLayer = layer.metadata as CatalogueLayer;
    this.map.removeLayer(layer.id);
    this.map.removeSource(couche.nom + "_maplibre_source");
  }

  /**
   * Make a layer invisible in th map
   * @param layer
   */
  setLayerInvisible(layerSpecification: LayerSpecification) {
    let layer = this.map.getLayer(layerSpecification.id);
    layer.setLayoutProperty("visibility", "none");
  }

  /**
   * Make a layer visible in th map
   * @param layer
   */
  setLayerVisible(layerSpecification: LayerSpecification) {
    let layer = this.map.getLayer(layerSpecification.id);
    layer.setLayoutProperty("visibility", "visible");
  }

  /**
   * construct a layersInMap Object fron a layer in the map
   * @param layerSpecification LayerSpecification
   * @return layersInMap
   */
  constructAlyerInMap(layerSpecification: LayerSpecification): layersInMap {
    let couche: CatalogueLayer = layerSpecification.metadata as CatalogueLayer;
    return {
      tocCapabilities: couche.tocCapabilities,
      legendCapabilities: couche.legendCapabilities,
      nom: couche.nom,
      type_layer: couche.type_layer,
      properties: couche.properties,
      image: couche.iconImagette,
      data: null,
      zIndex: this.map
        .getStyle()
        .layers.findIndex((ss) => ss.id == layerSpecification.id),
      visible: layerSpecification.layout.visibility === "visible",
      layer: [layerSpecification],
      descriptionSheetCapabilities: couche.descriptionSheetCapabilities,
    };
  }

  /**
   * Get all layers in the TOC.
   * Remark : all layer not in group call "group-layer-shadow"
   * @return Array<layersInMap>
   */
  getAllLayersInToc(): Array<layersInMap> {
    var allLayers = this.map.getStyle().layers;

    return allLayers
      .filter(
        (layerSpecification) =>
          layerSpecification.metadata != undefined &&
          layerSpecification.metadata["inToc"] == true
      )
      .map((layerSpecification) => {
        let couche: CatalogueLayer =
          layerSpecification.metadata as CatalogueLayer;
        let layerInMap: layersInMap =
          this.constructAlyerInMap(layerSpecification);
        return layerInMap;
      });
  }

  /**
   * Edit the zIndex of a layer:
   * Will set the Zindex of the layer and
   * - reduce by one all layer that Zindex are < this layer
   * - increase by one all layer that zIndex are > this layer
   * @param layer any layer to edit zindex
   * @param zIndex number
   */
  editZindexOfLayer(
    layerSpecification: LayerSpecification,
    zIndex: number,
    currentIndex: number
  ) {
    var allLayersInToc = this.getAllLayersInToc()
      .filter((layerProp) => layerProp.type_layer == "geosmCatalogue")
      .filter((layerProp, index, self) => {
        /**
         * unique layer ^^
         */
        return (
          self
            .map((item) => item.properties.couche_id + item.properties["type"])
            .indexOf(
              layerProp.properties.couche_id + layerProp.properties["type"]
            ) === index
        );
      });

    let direction = zIndex - currentIndex > 0 ? 1 : -1;
    if (currentIndex == 0) {
      this.map.moveLayer(layerSpecification.id);
    } else {
      if (direction == 1) {
        this.map.moveLayer(
          layerSpecification.id,
          allLayersInToc.find(
            (kk) =>
              kk.zIndex ==
              allLayersInToc.find(
                (kk) => kk.layer[0].id == layerSpecification.id
              ).zIndex +
                (zIndex - currentIndex + 1)
          ).layer[0].id
        );
      } else {
        this.map.moveLayer(
          layerSpecification.id,
          allLayersInToc.find(
            (kk) =>
              kk.zIndex ==
              allLayersInToc.find(
                (kk) => kk.layer[0].id == layerSpecification.id
              ).zIndex -
                (currentIndex - zIndex)
          ).layer[0].id
        );
      }
    }
  }

  getBBoxFormCoordinates(coordinates: Coordinate): BBox {
    let boundigBoxClick3857 = bbox(
      toMercator(buffer(toWgs84(point(coordinates)), 1, { units: "meters" }))
    );
    return boundigBoxClick3857;
  }

  /**
   *click sur la carte
   *@param evt MapBrowserEvent
   *@param (param :dataFromClickOnMapInterface)=>void
   */
  mapHasCliked(
    evt: MapMouseEvent & Object
  ): Observable<dataFromClickOnMapInterface[]> {
    var coordinate = this.map.unproject(evt.point);
    var mapCanvas = this.map.getCanvas();
    var mapBounds = this.map.getBounds();

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
          point([coordinate.lng, coordinate.lat]),
          mapWithInMeter / mapCanvas.width,
          { units: "kilometers" }
        )
      )
    );

    let listLayerInMapWithUrlCarto = this.getAllLayersInToc()
    .filter((layerInmap)=>layerInmap.visible)
    .map(
      (layerInMap, index) => {
        let couche = layerInMap.layer[0].metadata as CatalogueLayer;
        return { url: couche.url, layerInMap: layerInMap, couche: couche };
      }
    );

    let listLayerInMapWithUniqueUrlCarto: {
      [key: string]: Array<{
        url: string;
        layerInMap: layersInMap;
        couche: CatalogueLayer;
      }>;
    } = listLayerInMapWithUrlCarto.reduce(function (r, a) {
      r[a.url] = r[a.url] || [];
      r[a.url].push(a);
      return r;
    }, Object.create(null));

    Object.entries(listLayerInMapWithUniqueUrlCarto)
      .filter((result) => result[1].length > 0)
      .map((result, index) => {
        let identifiants = result[1].map((res) => {
          return res.couche.identifiant.join(",");
        });

        let url =
          environment.backendUrl +
          "/api/provider/vector/sheet?map=" +
          result[1][0].couche.qgis_project +
          "&FEATURE_COUNT=3&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=" +
          identifiants.join(",") +
          "&QUERY_LAYERS=" +
          identifiants.join(",") +
          "&BBOX=" +
          boundigBoxClick3857.join(",") +
          "&CRS=EPSG:3857&INFO_FORMAT=application/json&I=50&J=50&WIDTH=101&HEIGHT=101&WITH_GEOMETRY=true";
        /**
         * replace key url with the GetFeatureInfo one
         */
        delete Object.assign(listLayerInMapWithUniqueUrlCarto, {
          [url]: listLayerInMapWithUniqueUrlCarto[result[0]],
        })[result[0]];
      });

    return concat(
      ...Object.entries(listLayerInMapWithUniqueUrlCarto).map((result) =>
        this.backendApiService
          .getFeatureInfoWMS<FeatureCollection>(result[0])
          .pipe(
            retryWhen((errors) =>
              errors.pipe(
                tap((val: HttpErrorResponse) => {
                  // console.log(val)
                }),
                delayWhen((val: HttpErrorResponse) => timer(500)),
                // delay(2000),
                take(3)
              )
            ),
            catchError(() => EMPTY)
          )
      )
    ).pipe(
      take(Object.entries(listLayerInMapWithUniqueUrlCarto).length),
      toArray(),
      map((featureCollections) => {
        let features: Array<Feature> = [];
        let response: Array<dataFromClickOnMapInterface> = [];
        let coord3857: [number, number] = [
          toMercator(point([coordinate.lng, coordinate.lat])).geometry
            .coordinates[0],
          toMercator(point([coordinate.lng, coordinate.lat])).geometry
            .coordinates[1],
        ];

        featureCollections.map((fc) => {
          features = features.concat(fc.features);
        });

        listLayerInMapWithUrlCarto.map((ll) => {
          let data: dataFromClickOnMapInterface = {
            type:
              ["geojson", "wfs"].indexOf(ll.couche.type) == -1
                ? "raster"
                : "vector",
            data: {
              coord: coord3857,
              bbox: boundigBoxClick3857,
              feature: features.filter(
                (feat) =>
                  ll.couche.identifiant.filter(
                    (identifiant) =>
                      feat.id.toString().split(".")[0] === identifiant
                  ).length > 0
              ),
              layers: ll.layerInMap.layer,
              couche: ll.couche,
            },
          };
          if (data.data.feature.length > 0) {
            response.push(data);
          }
        });

        return response;
      })
    );
  }
}

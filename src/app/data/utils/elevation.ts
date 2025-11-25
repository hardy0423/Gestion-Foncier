import { Injectable } from "@angular/core";
import SphericalMercator from "@mapbox/sphericalmercator";
import {
  bbox,
  buffer,
  point,
  toMercator,
} from "@turf/turf";
import { Feature, FeatureCollection } from "geojson";
import {
  LayerSpecification,
  LngLat,
  LngLatBounds,
  Map,
  MapMouseEvent,
} from "maplibre-gl";
import { concat, EMPTY, Observable } from "rxjs";
import {
  catchError,
  map,
  toArray,
} from "rxjs/operators";
import { environment } from "src/environments/environment";
import { AppInjector } from "src/helper/app-injector.helper";
import { BackendApiService } from "../services/backend-api.service";

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

/**
 * Handle diverse operation in link with the map
 */
@Injectable()
export class Elevation {
  environment = environment;
  backendApiService: BackendApiService = AppInjector.get(BackendApiService);

  constructor(public map: Map) {

  }


  /**
   * Constructs an elevation layer and adds it to the map.
   *
   * @return {void} This function does not return a value.
   */
    addElevationLayer(): void {
      let source_name = "elevation_maplibre_source";
      let layer_name = "elevation_maplibre_layer";
      let layer: LayerSpecification;
      let qgis_file_project_elevation = environment.elevation_project_file;
  
      var mapCanvas = this.map.getCanvas();
      let sw = new LngLat(7.41874, 47.55563);
      let ne = new LngLat(7.60569, 47.68857);
      let bounds = new LngLatBounds(sw, ne);
      
      var imageCoordinates = getExtentCoordinatesFromBounds(bounds);
      var imageExtent3857 = wmsExtent130FromBounds(bounds);

      let wmsWidth = Math.floor(mapCanvas.width / window.devicePixelRatio);
      let wmsHeight = Math.floor(mapCanvas.height / window.devicePixelRatio);
      let urlWms =
        environment.backendUrl +
        "/api/group/wms" +
        "?MAP=" + qgis_file_project_elevation + 
        "&FORMAT=image/png&SERVICE=WMS&VERSION=1.3.0&FORMAT_OPTIONS=dpi:180" +
        "&REQUEST=GetMap&CRS=EPSG:3857&TRANSPARENT=true&WIDTH=" +
        wmsWidth +
        "&HEIGHT=" +
        wmsHeight +
        "&LAYERS=geo_elevation" +
        "&TILED=true" +
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
          visibility: "visible",
        },
        paint: {
          "raster-fade-duration": 0,
          "raster-opacity": 0,
        },
      };
  
      this.map.addLayer(layer);
    }


  /**
   * Click on map and get elevation data.
   *
   * @param {MapMouseEvent & Object} evt - The event parameter.
   * @return {Observable<dataFromClickOnMapInterface[]>} The observable of dataFromClickOnMapInterface array.
   */
    mapHasClikedElevation(
      evt: MapMouseEvent & Object
    ): Observable<number> {
      var coordinate = this.map.unproject(evt.point);
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
            point([coordinate.lng, coordinate.lat]),
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
  
          if (features[0]?.properties) {
            response = features[0]?.properties[0]?.value;
          }
          if (!response) {
            response = 0
          }
          return response;
        })
      );
    }


    /**
   * Click on map and add layeur contour on map.
   *
   * @param {MapMouseEvent & Object} evt - The event parameter.
   * @return {Observable<dataFromClickOnMapInterface[]>} The observable of dataFromClickOnMapInterface array.
   */
    addContourLayer(): void {
      let source_name = "contour_maplibre_source";
      let layer_name = "countour_maplibre_layer";
      let layer: LayerSpecification;
      let qgis_file_project_elevation = environment.elevation_project_file;

      var url =
        environment.backendUrl + 
        "/api/group/wfs" +
        "?MAP=" + qgis_file_project_elevation + 
        "&" +
        "SERVICE=WFS&VERSION=1.1.0&SRSNAME=EPSG:3857&REQUEST=GetFeature&OUTPUTFORMAT=geojson&TYPENAME=geo_contours&FROMELEVATION=True";

      this.backendApiService
        .getFeatureInfoWFS<FeatureCollection>(url)
        .pipe(
          catchError(() => EMPTY)
        ).subscribe((featureCollections) => {
          this.map.addSource(source_name, {
            type: "geojson",
            data: featureCollections,
            promoteId:'id',    
          });

          layer = {
              id: layer_name,
              type: "line",
              source: source_name,
              layout: {
                  visibility: "visible",
                  "line-join": "round",
                  "line-cap": "round",
              },
              paint: {
                "line-opacity": 0,
                "line-width": 2,
                "line-color": [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false], '#36f3f3', 'yellow',
                ]
              }
          };
          this.map.addLayer(layer);
        });
    }
}

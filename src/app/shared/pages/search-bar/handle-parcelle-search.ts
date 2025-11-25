import { Layer, Parcelle } from "src/app/data/models/type";
import { environment } from "src/environments/environment";
import { AppInjector } from "src/helper/app-injector.helper";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { filterOptionInterface } from "./search-bar.component";
import maplibregl, { GeoJSONSource, LngLatLike, Map, Popup } from "maplibre-gl";
import { EMPTY } from "rxjs";
import { catchError, take, tap } from "rxjs/operators";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import { MapsService } from "src/app/data/services/maps.service";
import * as turf from "@turf/turf";

/**
 * class for handle couche thematique   search:
 * - format data from server to display list od response
 * - format response when user select an option
 */
export class handleParcelleSearch {
  manageCompHelper: ManageCompHelper = AppInjector.get(ManageCompHelper);
  mapsService: MapsService = AppInjector.get(MapsService);
  geoData: GeoDataService = AppInjector.get(GeoDataService);
  constructor() {}

  /**
   * format response from server into a list to display on ui
   * @param responseDB any
   */
  formatDataForTheList(responseDB: Parcelle[]): Array<filterOptionInterface> {
    var response: Array<filterOptionInterface> = responseDB.map((layer) => {
      return {
        id: layer.id,
        commune: layer.commune,
        idu: layer.idu,
        nom_commune: layer.nom_commune,
        parcelle: layer.parcelle,
        proprietaire: layer.proprietaire,
        section: layer.section,
        surface: layer.surface,
        typeOption: "parcelle",
      };
    });
    return response;
  }

  /**
   * Use to format text that will appear after an option is choose in the autocomplete use to select layers in the UI
   * @param data filterOptionInterface
   * @return string
   */
  displayWith(data: filterOptionInterface): string {
    return "";
  }

  /**
   *  call when an option is select by the user
   * @param data searchLayerToDownlodModelInterface
   */
  optionSelected(data: filterOptionInterface, map: Map, popup: Popup) {
    let parcelle: Parcelle = data;
    this.mapsService
      .getParcelle(parcelle.id)
      .pipe(
        take(1),
        catchError(() => {
          return EMPTY;
        }),
        tap((geojsonData) => {
          setTimeout(() => {
            const feature =
              geojsonData.features && geojsonData.features.length > 0
                ? geojsonData.features[0]
                : null;

            if (feature) {
              let sourceName = "land-search-source";
              let layerName = "land-search-layer";
              if (map.getSource(sourceName) && map.getLayer(layerName)) {
                let source = map.getSource(sourceName);
                if (source instanceof GeoJSONSource) {
                  source.setData(geojsonData);
                }
              } else {
                map.addSource(sourceName, {
                  type: "geojson",
                  data: geojsonData,
                });

                map.addLayer({
                  id: layerName,
                  type: "line",
                  source: sourceName,
                  layout: {},
                  paint: {
                    "line-color": "yellow",
                    "line-width": 4,
                  },
                });
              }

              let buffered = turf.buffer(geojsonData, 20, {
                units: "meters",
              });

              let bbox = turf.bbox(buffered);
              let bboxPolygon = turf.bboxPolygon(bbox);
              map.fitBounds([
                [bboxPolygon.bbox[0], bboxPolygon.bbox[1]],
                [bboxPolygon.bbox[2], bboxPolygon.bbox[3]],
              ], {
                maxZoom: 20
              });

              let multiPolygon = turf.multiPolygon(
                geojsonData.features[0].geometry["coordinates"]
              );
              let centroid = turf.centroid(multiPolygon);
              let propertiesString = "";
              let properties = geojsonData.features[0].properties;
              let keys = Object.keys(properties);
              keys.forEach((key) => {
                propertiesString +=
                  '<tr><th style="text-align:right; width:150px">' +
                  key +
                  " : </th><td>" +
                  properties[key] +
                  "</td></tr>";
              });

              let htmlContent = `
                <table>
                ${propertiesString}
                </table>
              `;
              popup
                .setLngLat(centroid.geometry.coordinates as LngLatLike)
                .setHTML(htmlContent)
                .setMaxWidth("400px")
                .addTo(map);
            }
          }, 500);
        })
      )
      .subscribe();
  }
}

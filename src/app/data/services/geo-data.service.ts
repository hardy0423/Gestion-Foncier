import { Injectable } from "@angular/core";
import { NotifierService } from "angular-notifier";
import { Map } from "maplibre-gl";
import { BehaviorSubject } from "rxjs";
import { environment } from "src/environments/environment";
import { CategoryStyle, Group, GroupWithLayers, Layer, LayerProviders } from "../models/type";
import { StoreService } from "../store/store.service";
import { CartoHelper, CatalogueLayer } from "../utils/cartoHelper";

@Injectable({
  providedIn: "root",
})
export class GeoDataService {
  public storeLayer: (group: Group, layer: Layer) => void;
  public getLayerInMap: (layer_id: number) => { group: Group; layer: Layer };
  public destroyLayer: (layer_id: number) => void;

  public groupsLayerInMap: BehaviorSubject<
    Array<{
      group: Group;
      layer: Layer;
    }>
  > = new BehaviorSubject<
    Array<{
      group: Group;
      layer: Layer;
    }>
  >([]);

  private layers = new BehaviorSubject([]);
  layers$ = this.layers.asObservable();

  constructor(public notifier: NotifierService, public store: StoreService) {
    this.getLayerInMap = (layer_id: number): { group: Group; layer: Layer } => {
      return this.groupsLayerInMap
        .getValue()
        .find((groupLayer) => groupLayer.layer.layer_id == layer_id);
    };

    this.storeLayer = (group: Group, layer: Layer) => {
      if (!this.getLayerInMap(layer.layer_id)) {
        let groupLayers = this.groupsLayerInMap.getValue();
        groupLayers.push({ group: group, layer: layer });
        this.groupsLayerInMap.next(groupLayers);
      }
    };

    this.destroyLayer = (layer_id: number) => {
      let groupLayers = this.groupsLayerInMap
        .getValue()
        .filter((groupLayer) => groupLayer.layer.layer_id != layer_id);
      this.groupsLayerInMap.next(groupLayers);
    };
  }
  changeData(layers: Layer[]) {
    this.layers.next(layers);
  }

  /**
   * Recuperer les dimensions d'une image a partir de son lien
   * @param urlImage string url of the image
   * @return (dimenions:{width:number,height:number}) => void
   */
  geDimensionsOfImage(
    urlImage: string,
    callBack: (dimenions: { width: number; height: number }) => void
  ) {
    try {
      var img = new Image();
      img.onload = function () {
        callBack({ width: img.width, height: img.height });
      };
      img.src = urlImage;
    } catch (error) {
      callBack(undefined);
    }
  }

  /**
   * Remove layer of type 'couche' in map
   * @param layer Layer
   */
  removeLayer(layer_id: number, map: Map) {
    let layers = new CartoHelper(map).getLayerByPropertiesCatalogue({
      couche_id: layer_id,
      type: "couche",
    });

    while (layers.length > 0) {
      new CartoHelper(map).removeLayerToMap(layers[0]);

      layers = new CartoHelper(map).getLayerByPropertiesCatalogue({
        couche_id: layer_id,
        type: "couche",
      });
    }
    this.destroyLayer(layer_id);

    if (this.store.user.layers_saved) {
      // remove layer to list of layer in progress
      let layersStr = localStorage.getItem("current_layers");
      let layers = layersStr.split(";");
      layers.forEach((element, index) => {
        let a = element.split(",");
        if (layer_id == parseInt(a[0])) {
          layers.splice(index, 1);
        }
      });
      layersStr = layers.join(";");
      localStorage.setItem("current_layers", layersStr);
    }
  }

  /**
   * Add layer of type 'couche' to map
   * @param couche Layer
   */

  addLayer(layer: Layer, map: Map, group: Group) {
    let cartoHelperClass = new CartoHelper(map);
    let isLayerInMap =
      new CartoHelper(map).getLayerByName(layer.name) != undefined;

    if (isLayerInMap) {
      this.notifier.notify("error", "This layer already exist in the map");
      throw new Error("his layer already exist in the map");
    } else if (layer.providers.length == 0) {
      this.notifier.notify("error", "This layer have no providers");
      throw new Error("his layer have no providers");
    } else {
      this.storeLayer(group, layer);
      this.geDimensionsOfImage(
        environment.backendUrl + layer.square_icon,
        (dimension: { width: number; height: number }) => {
          if (dimension == undefined) {
            this.removeLayer(layer.layer_id, map);
          }
          let size = 0.4;

          if (dimension) {
            size = 40 / dimension.width;
          }

          var pathImg = layer.square_icon;
          layer.providers
            .filter((provider) => provider.vp.state == "good")
            .map((provider: LayerProviders) => {
              let url = provider.vp.url_server;
              let catalogueLayer: CatalogueLayer = {
                nom: layer.name,
                type: "wms",
                identifiant: [provider.vp.id_server],
                qgis_project: provider.vp.path_qgis,
                type_layer: "geosmCatalogue",
                url: url,
                visible: true,
                inToc: true,
                properties: {
                  couche_id: layer.layer_id,
                  style_id:provider.vs_id,
                  group_id: group.group_id,
                  type: "couche",
                },
                iconImagette: environment.backendUrl + pathImg,
                icon: environment.backendUrl + pathImg,
                cluster: true,
                size: size,
                legendCapabilities: [],
                styleWMS: [provider.vs.name],
                descriptionSheetCapabilities: provider.vp.source,
                tocCapabilities: {
                  share: true,
                  metadata: true,
                  opacity: true,
                  removable: true,
                },
                geometryType: provider.vp.geometry_type,
                canRead: layer.read,
                canWrite: layer.write,
                categoryStyles: {
                  list: [],
                  toogled: false
                }
              };
              let layerOl = cartoHelperClass.constructLayer(catalogueLayer);

              cartoHelperClass.addLayer(layerOl, catalogueLayer);
            });
        }
      );
    }

    if (this.store.user.layers_saved) {
      // add layer to list of layer in progress
      const newLayer = layer.layer_id + "," + layer.group + ",couche";
      let layersInToc = localStorage.getItem("current_layers");
      if (layersInToc && layersInToc != undefined) {
        let layersId = [] as number[];
        layersInToc.split(";").forEach((item) => {
          const itemLayer = item.split(",");
          layersId.push(parseInt(itemLayer[0]));
        });
        if (!layersId.includes(layer.layer_id)) {
          localStorage.setItem("current_layers", layersInToc + ";" + newLayer);
        }
      } else {
        localStorage.setItem("current_layers", newLayer);
      }
    }
  }

  getGroupOfLayer(
    layer: Layer,
    groups: Array<GroupWithLayers>
  ): GroupWithLayers {
    return groups.find((group) => {
      return group.layers.find((lay) => lay.layer_id === layer.layer_id);
    });
  }
}

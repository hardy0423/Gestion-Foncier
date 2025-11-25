import {
  Component,
  Input,
  OnInit,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { MatExpansionPanel } from "@angular/material/expansion";
import { MatSelectionList } from "@angular/material/list";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { Map } from "maplibre-gl";
import { ReplaySubject, Subject, tap } from "rxjs";
import { GroupWithLayers, Layer } from "src/app/data/models/type";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import { MapsService } from "src/app/data/services/maps.service";
import { StoreService } from "src/app/data/store/store.service";
import { CartoHelper } from "src/app/data/utils/cartoHelper";
import { environment } from "src/environments/environment";

export interface GroupCategory {
  id: string;
  prefix: string;
  group: Array<GroupWithLayers>
}

@Component({
  selector: "app-list-map-layers",
  templateUrl: "./list-map-layers.component.html",
  styleUrls: ["./list-map-layers.component.scss"],
})
export class ListMapLayersComponent implements OnInit {
  public env = environment;

  @Input() groups: Array<GroupWithLayers>;
  @Input() map: Map;
  group_category: Array<GroupCategory> = [];
  group_prefix_array: Array<string> = [];

  onInitInstance: () => void;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  private readonly notifier: NotifierService;

  @ViewChildren(MatSelectionList) set matSelectionLists(
    matSelectionLists: QueryList<MatSelectionList>
  ) {
    if (matSelectionLists) {
      matSelectionLists.map((matSelectionList) => {
        matSelectionList.selectionChange
          .pipe(
            tap((options) => {
              options.options.map((parameters) => {
                let isOptionSelected: boolean = parameters.selected;
                let layer: Layer = parameters.value;

                if (isOptionSelected) {
                  try {
                    this.geoData.addLayer(
                      layer,
                      this.map,
                      this.geoData.getGroupOfLayer(layer, this.groups)
                    );
                  } catch (error) {
                    parameters.toggle();
                  }
                } else {
                  try {
                    this.geoData.removeLayer(layer.layer_id, this.map);
                  } catch (error) {
                    console.error(error);
                    parameters.toggle();
                  }
                }
              });
            })
          )
          .subscribe();
      });
    }
  }

  constructor(
    public store: StoreService,
    public geoData: GeoDataService,
    public router: Router,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public mapService: MapsService
  ) {
    this.notifier = notifierService;

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };
  }

  ngOnInit(): void {
    let group_prefix_array = [...new Set(this.getAllGroupPrefix(this.groups))]
    if(group_prefix_array.length > 0 ) {
      for (let prefix of group_prefix_array){
        for (let group of this.groups){
          if(group.name.includes(prefix + "_")){
            let array : Array<GroupWithLayers> = [group]
            if (!this.group_category.length){
              this.group_category.push({id: prefix, prefix: prefix, group: array});
            }
            else{
              if(this.group_category.some(el => el.prefix === prefix)){
                this.group_category.filter(el => el.prefix === prefix)[0].group.push(group);
              }
              else{
                this.group_category.push({id: prefix, prefix: prefix, group: array});
              }
            }
          }
          else{
            let array : Array<GroupWithLayers> = [group]
            this.group_category.push({id: group.name, prefix: null, group: array});
          }
        }
      }
     }else {
        for (let group of this.groups){
            let array : Array<GroupWithLayers> = [group]
            this.group_category.push({id: group.name, prefix: null, group: array});
        }
     }




    //remove groups already in category
    this.group_category = this.group_category.filter((gc) => !group_prefix_array.some(el => gc.id.includes(el + "_")));
    // set prefix to null from groups with only one layer
    this.group_category.filter((gc) => {
      if (gc.group.length == 1 && gc.prefix != null){
        gc.prefix = null
      }
    })
    // remove duplicated groups
    let cat = {}
    this.group_category = this.group_category.filter(obj => !cat[obj.id] && (cat[obj.id] = true));
    this.onInitInstance();
  }

  getAllGroupPrefix(groups: Array<GroupWithLayers>){
    let group_prefix_array = []
    for (let group of groups){
      if(group.name.includes("_")){
        let group_prefix = group.name.split("_")[0]
        group_prefix_array.push(group_prefix);
      }
    }

    return group_prefix_array;
  }

  isLayerInMap(layer: Layer) {
    let cartoLayer = new CartoHelper(this.map);
    return cartoLayer.getLayerByName(layer.name) != undefined;
  }

  /**
   * Is this layer entire defined in the adminstrative panel ?
   * If it is not, we can not add it to the map
   * @param layer Layer
   */
  shouldDisabled(layer: Layer): boolean {
    if (
      layer.providers.length == 0 ||
      layer.providers?.filter((provider) => provider.vp.state == "good")
        .length == 0
    ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   *
   * @param color
   */
  makeColor(color) {
    document.documentElement.style.setProperty("--permission", color);
  }

  /**
   * Select all and deselect all the layers in a group
   * @param group GroupLayer, @param event Checkbox
  */
  showCheckBox(group: GroupWithLayers){
    return group.layers.length > 0;
  }

  checkAll(list: MatSelectionList, group: GroupWithLayers){
    if(group.layers.length == 0) return false;

    if(list.options){
      if(list.selectedOptions.selected.length == list.options.length) return true;
    }
    return false;
  }

  enableAllLayers(group: MatSelectionList, event: boolean, panel: MatExpansionPanel) {
    panel.open();

    // Select all
    if (event) {
      group.selectAll().map((parameters) => {
        let layer: Layer = parameters.value;
        
        if (layer.providers.length != 0 || layer.providers?.filter((provider) => provider.vp.state == "good").length != 0){
          try {
            this.geoData.addLayer(
              layer,
              this.map,
              this.geoData.getGroupOfLayer(layer, this.groups)
            );
          } catch (error) {
            parameters.toggle();
          }
        } 
      });
    } 
    // Deselect all
    else {
      group.deselectAll().map((parameters) => {
        let layer: Layer = parameters.value;
        try {          
          this.geoData.removeLayer(layer.layer_id, this.map);
        } catch (error) {
          console.error(error);
          parameters.toggle();
        }
      });
    }
  }
}

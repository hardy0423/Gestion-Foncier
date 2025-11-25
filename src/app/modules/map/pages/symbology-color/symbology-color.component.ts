import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Map } from "maplibre-gl";
import { ReplaySubject, Subject } from "rxjs";
import { CategoryStyle, LayerProviders } from "src/app/data/models/type";
import { StoreService } from "src/app/data/store/store.service";
import { CatalogueLayer, layersInMap } from "src/app/data/utils/cartoHelper";

/**
 * interface of the model to search the GPS coordinate
 */
export interface SymbologyData {
  layer: LayerProviders;
  layerInMap: layersInMap;
  map: Map;
}

export interface ColorData {
  label: string;
  hexadecimal: string;
}

@Component({
  selector: "app-symbology-color",
  templateUrl: "./symbology-color.component.html",
  styleUrls: ["./symbology-color.component.scss"],
})
export class SymbologyColorComponent implements OnInit {
  public onInitInstance: () => void;

  toggle: boolean = false;
  default_color: string = "#2889e9";
  arrayColors: Array<ColorData> = new Array<ColorData>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SymbologyData,
    public dialogRef: MatDialogRef<SymbologyColorComponent>,
    public store: StoreService,
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  onCancel(): void {
    this.dialogRef.close("cancel");
  }

  /**
   * on select new color
   */
  public onSelect(color: any, category: CategoryStyle): void {
    category.isUpdate = !category.isUpdate? !category.isUpdate: category.isUpdate;
    category.chosenColor = color;

    // add the color picked with the symbol ID
    let label_color : ColorData = {
      label: category.name,
      hexadecimal: color,
    }
    this.arrayColors.push(label_color);
  }

  /**
   * delete color picked
   */
  public deleteChosenColor(category: CategoryStyle): void {
    category.isUpdate = false;
    category.chosenColor = null;
    this.arrayColors = this.arrayColors.filter(arr => arr.label !== category.name)
  }

  /**
   * open color picker dialog for symbology categorized
   */
  toggleColorPicker(category: CategoryStyle): void {
    category.isToggle = !category.isToggle;
  }
 
  saveColor() {
    if(this.arrayColors.length > 0){
      let metadata = this.data.layerInMap.layer.filter((lay) => lay.type == "raster")[0].metadata as CatalogueLayer;
      let data = {
        group_id: this.store.user?.group_id,
        layer_id: metadata?.properties.couche_id,
        project: metadata.qgis_project,
        layer_name: metadata.identifiant[0],
        color: this.arrayColors,
      };
      this.dialogRef.close(data);
    }
    else{
      this.dialogRef.close("cancel");
    }
  }
}

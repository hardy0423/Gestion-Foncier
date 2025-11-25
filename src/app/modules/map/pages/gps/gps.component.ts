import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { FlyToOptions, LngLatLike, Map, Marker } from "maplibre-gl";
import { ReplaySubject, Subject } from "rxjs";
import { CartoHelper } from "src/app/data/utils/cartoHelper";

/**
 * interface of the model to search the GPS coordinate
 */
export interface GpsData {
  latitude: number;
  longitude: number;
  map: Map;
}

@Component({
  selector: "app-gps-dialog",
  templateUrl: "./gps.component.html",
  styleUrls: ["./gps.component.scss"],
})
export class GpsComponent implements OnInit {
  public onInitInstance: () => void;
  toZoom: LngLatLike = [null, null];
  form: FormGroup = new FormGroup({});
  
  constructor(
    private fBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: GpsData,
    public dialogRef: MatDialogRef<GpsComponent>
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    this.form = this.fBuilder.group({
      lat: new FormControl(this.data.latitude, [Validators.required, Validators.pattern("[+-]?([0-9]*[.])?[0-9]+")]),
      lng: new FormControl(this.data.longitude, [Validators.required, Validators.pattern("[+-]?([0-9]*[.])?[0-9]+")])
    });
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  onCancel(): void {
    this.dialogRef.close("cancel");
  }

  get lat() {
    return this.form.get('lat');
  }
  
  get lng() {
    return this.form.get('lng');
  }

  zoomOnCoordinate() {
    if(this.form.valid) {
      let flyToOptions: FlyToOptions = {
        center: [
          Number(this.data.longitude), 
          Number(this.data.latitude)
        ],
        zoom: 18,
        essential: true
      };
      this.dialogRef.close("zoom");
      this.data.map.flyTo(flyToOptions);
    }
  }
}

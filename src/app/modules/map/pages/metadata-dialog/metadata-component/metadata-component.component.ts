import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LineString } from '@turf/helpers';
import { ReplaySubject, Subject } from 'rxjs';
import { Metadata } from 'src/app/data/models/type';
import { environment } from "src/environments/environment";
import {
  Group,
  Layer
} from "src/app/data/models/type";
import { GeoDataService } from 'src/app/data/services/geo-data.service';
import { take, tap } from "rxjs/operators";

@Component({
  selector: 'app-metadata-component',
  templateUrl: './metadata-component.component.html',
  styleUrls: ['./metadata-component.component.scss']
})
export class MetadataComponentComponent implements OnInit {
  public onInitInstance: () => void;
  
  environment = environment;

  /**
   * current dataOsmLAyer
   */
  dataOsmLAyer: {
    group: Group;
    layer: Layer;
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Metadata,
    public dialogRef: MatDialogRef<MetadataComponentComponent>,
    public geoDataService: GeoDataService,
    ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    onInit.pipe(
      tap(() => {
        this.dataOsmLAyer = this.geoDataService.getLayerInMap(
          this.data.layer
        );
      }),
      take(1)
    ).subscribe()
  }

  ngOnInit(): void {
    this.onInitInstance();
  }
}

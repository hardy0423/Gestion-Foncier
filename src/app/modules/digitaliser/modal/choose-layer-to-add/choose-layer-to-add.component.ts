import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataForLegend } from 'src/app/data/models/layer-to-digitalise';

export interface  LayerToAddChoose extends DataForLegend{
  geometryType:string
  layer_id:number
}
@Component({
  selector: 'app-choose-layer-to-add',
  templateUrl: './choose-layer-to-add.component.html',
  styleUrls: ['./choose-layer-to-add.component.scss']
})

export class ChooseLayerToAddComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<ChooseLayerToAddComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LayerToAddChoose[]
  ) { }

  ngOnInit(): void {
  }

  choose(value:LayerToAddChoose){
    this.dialogRef.close(value)
  }

  close(){
    this.dialogRef.close()
  }

}

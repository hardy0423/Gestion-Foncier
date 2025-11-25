import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataForPreview, Layer } from 'src/app/data/models/type';

@Component({
  selector: 'app-layer-details',
  templateUrl: './layer-details.component.html',
  styleUrls: ['./layer-details.component.scss']
})
export class LayerDetailsComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<LayerDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public layersForPreview: Layer
  ) { }

  ngOnInit(): void {
  }

  closeDialog(result: boolean) {
    this.dialogRef.close(result)
  }

}

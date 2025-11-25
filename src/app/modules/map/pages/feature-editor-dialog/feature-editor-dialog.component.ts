import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ModelDataEdition } from 'src/app/data/models/digitaliser';
import { DigitaliserComponent } from 'src/app/modules/digitaliser/digitaliser.component';

@Component({
  selector: 'app-feature-editor-dialog',
  templateUrl: './feature-editor-dialog.component.html',
  styleUrls: ['./feature-editor-dialog.component.scss']
})
export class FeatureEditorDialogComponent implements OnInit {

  @ViewChild(DigitaliserComponent) set digitaliserComponent (digitaliserComponent:DigitaliserComponent){
    this.close = ()=>{
      digitaliserComponent.onCloseInstance()
    }
  }
  
  close:()=>void
  
  constructor(
    public dialogref:MatDialogRef<FeatureEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : ModelDataEdition
    ) { }

  ngOnInit(): void {
  }


  closeDialod(status:boolean){
    this.dialogref.close(status)
  }
}

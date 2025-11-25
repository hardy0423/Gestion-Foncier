import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from 'src/app/shared/shared.module';
import { CustomSheetComponent } from './pages/descriptive-sheet/custom-sheet/custom-sheet.component';
import { DescriptiveSheetComponent } from './pages/descriptive-sheet/descriptive-sheet.component';
import { ListMapLayersComponent } from './pages/list-map-layers/list-map-layers.component';
import { MapFilterComponent } from './pages/map-filter/map-filter.component';
import { MapComponent } from './pages/map/map.component';
import { MapRoutingModule } from './map-routing.module';
import { TableOfContentsComponent } from './pages/sidenav-right/table-of-contents/table-of-contents.component';
import { LegendComponent } from './pages/sidenav-right/legend/legend.component';
import { DigitaliserModule } from '../digitaliser/digitaliser.module';
import { FeatureEditorDialogComponent } from './pages/feature-editor-dialog/feature-editor-dialog.component';
import { AttributesTableComponent } from './pages/attributes-table/attributes-table.component';
import { ImpressionComponent } from './pages/impression/impression.component';
import { UpdateMultipleComponent } from './pages/attributes-table/update-multiple/update-multiple.component';
import { UpdateJoinTableComponent } from './pages/attributes-table/update-join-table/update-join-table.component';
import { UploadFileDataComponent } from './pages/attributes-table/upload-file-data/upload-file-data.component';
import { GpsComponent } from './pages/gps/gps.component';
import { MetadataComponentComponent } from './pages/metadata-dialog/metadata-component/metadata-component.component';
import { SymbologyColorComponent } from './pages/symbology-color/symbology-color.component';



@NgModule({
  declarations: [
    MapComponent,
    ListMapLayersComponent,
    MapFilterComponent,
    DescriptiveSheetComponent,
    ImpressionComponent,
    CustomSheetComponent,
    TableOfContentsComponent,
    LegendComponent,
    FeatureEditorDialogComponent,
    AttributesTableComponent,
    UpdateMultipleComponent,
    UpdateJoinTableComponent,
    UploadFileDataComponent,
    GpsComponent,
    MetadataComponentComponent,
    SymbologyColorComponent
  ],
  imports: [
    CommonModule,
    MapRoutingModule,
    SharedModule,
    DigitaliserModule
  ]
})
export class MapModule { }

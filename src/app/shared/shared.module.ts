import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { ComponentMaterialModule } from "./material-module";
import { NotifierModule } from "angular-notifier";
import { FlexLayoutModule } from "@angular/flex-layout";
import { SearchBarComponent } from "./pages/search-bar/search-bar.component";
import { ColorPickerComponent } from "./pages/color-picker/color-picker.component";
import { ColorPickerModule } from "ngx-color-picker";
import { SafeStylePipe } from "./pipe/safe-style.pipe";
import { FileUploadComponent } from "./pages/file-upload/file-upload.component";
import { ConfirmationDialogComponent } from "./pages/confirmation-dialog/confirmation-dialog.component";
import { LayerSwitcherComponent } from "./pages/layer-switcher/layer-switcher.component";
import { MesureComponent } from "./pages/mesure/mesure.component";
import { MAT_DATE_LOCALE } from "@angular/material/core";
import { SecurePipe } from "./pipe/secure.pipe";
import { CompareNumberComponent } from './pages/compare-number/compare-number.component';
import { WmsFilterComponent } from "./pages/wms-filter/wms-filter.component";

@NgModule({
  declarations: [
    SearchBarComponent,
    ColorPickerComponent, 
    SafeStylePipe, 
    FileUploadComponent, 
    ConfirmationDialogComponent, 
    LayerSwitcherComponent,
    MesureComponent,
    SecurePipe,
    CompareNumberComponent,
    WmsFilterComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ComponentMaterialModule,
    TranslateModule,
    FlexLayoutModule,
    ColorPickerModule,
    NotifierModule,
  ],
  exports: [
    CommonModule,
    ComponentMaterialModule,
    ReactiveFormsModule,
    FormsModule,
    NotifierModule,
    FlexLayoutModule,
    TranslateModule,
    SearchBarComponent,
    ColorPickerComponent,
    ColorPickerModule,
    SafeStylePipe,
    FileUploadComponent,
    ConfirmationDialogComponent,
    LayerSwitcherComponent,
    MesureComponent,
    SecurePipe,
    CompareNumberComponent,
    WmsFilterComponent
  ],
})
export class SharedModule {
  constructor(private translate: TranslateService) {
    translate.addLangs(["fr"]);
    translate.setDefaultLang("fr");
    translate.use("fr");
  }
}

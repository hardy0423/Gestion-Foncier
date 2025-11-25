import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DigitaliserComponent } from "./digitaliser.component";
import { SharedModule } from "src/app/shared/shared.module";
import { ChooseLayerToAddComponent } from "./modal/choose-layer-to-add/choose-layer-to-add.component";
import { FormDirective } from "src/app/data/directives/form.directive";
import { AttributeFormModule } from "../attribute-form/attribute-form.module";

@NgModule({
  declarations: [
    DigitaliserComponent,
    ChooseLayerToAddComponent,
    FormDirective,
  ],
  imports: [CommonModule, SharedModule, AttributeFormModule],
  exports: [DigitaliserComponent],
})
export class DigitaliserModule {}

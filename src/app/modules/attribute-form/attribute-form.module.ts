import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FeaturesFormComponent } from "./pages/features-form/features-form.component";
import { SharedModule } from "src/app/shared/shared.module";
import { FieldComponent } from "./field/field.component";
import { ComponentMaterialModule } from "src/app/shared/material-module";
import { FieldsComponent } from './fields/fields.component';
import { ReactiveFormsModule } from "@angular/forms";

@NgModule({
  declarations: [FeaturesFormComponent, FieldComponent, FieldsComponent],
  imports: [CommonModule, SharedModule,ComponentMaterialModule,ReactiveFormsModule],
  entryComponents: [FeaturesFormComponent, FieldComponent],
  exports: [FeaturesFormComponent],
})
export class AttributeFormModule {}

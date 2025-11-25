import { Component, Inject, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { AddGroupComponent } from "../add-group/add-group.component";

@Component({
  selector: "app-add-tab",
  templateUrl: "./add-tab.component.html",
  styleUrls: ["./add-tab.component.scss"],
})
export class AddTabComponent implements OnInit {

  form: FormGroup = new FormGroup({
    name: new FormControl(this.data.onglet ? this.data.onglet : null, [
      Validators.required,
      this.duplicateNameValidator(this.data.all),
    ]),
  });

  constructor(
    public translate: TranslateService,
    public notifierService: NotifierService,
    public manageCompHelper: ManageCompHelper,
    public dialogRef: MatDialogRef<AddGroupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      update:boolean
      all:Array<string>,
      onglet:string
    }
  ) {
  }

  ngOnInit(): void {}

  save() {
    this.dialogRef.close(this.form.value.name);
  }

  close(): void {
    this.dialogRef.close(null);
  }

  duplicateNameValidator(onglets: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const forbidden =
        this.data.all.includes(control.value) && control.value != this.data.onglet;
      return forbidden ? { forbiddenName: { value: control.value } } : null;
    };
  }
}

import { MatSnackBar } from '@angular/material/snack-bar';
import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { map } from 'rxjs/internal/operators/map';
import { Observable } from 'rxjs';
import { ConfirmationDialogComponent, ConfirmationDialogData } from 'src/app/shared/pages/confirmation-dialog/confirmation-dialog.component';
/**
 * Open some componenents like social share, loading,modal etc...
 * Dynamically add component in html
 */
@Injectable({
  providedIn: 'root'
})
export class ManageCompHelper {


  constructor(
    private _snackBar: MatSnackBar,
    public dialog: MatDialog,
  ) {

  }

  /**
   * Open confirmation dialog
   * @return Observable<boolean>
   */
  openConfirmationDialog(size: Array<string> | [], confirmationDialogData: ConfirmationDialogData): Observable<boolean> {

    let proprietes = {
      minWidth: 400,
      disableClose: true,
      data: confirmationDialogData
    }

    if (size.length > 0) {
      proprietes['width'] = size[0]
      proprietes['height'] = size[1]
    }

    const modal = this.dialog.open(ConfirmationDialogComponent, proprietes);

    return modal.afterClosed().pipe(
      map((value: boolean) => value)
    )
  }

}


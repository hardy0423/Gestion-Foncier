import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { filter, ReplaySubject, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-compare-number',
  templateUrl: './compare-number.component.html',
  styleUrls: ['./compare-number.component.scss']
})
export class CompareNumberComponent implements OnInit {
  @Input() result:AbstractControl

  public readonly form:FormGroup =  this.formBuilder.group({
    'sign': new FormControl(undefined, [Validators.required]),
    'value': new FormControl(undefined, [Validators.required]),
  })
  private readonly destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    private formBuilder: FormBuilder,
  ) { 
    this.form.valueChanges.pipe(
      takeUntil(this.destroyed$),
      filter(()=>this.result != undefined),
      tap(()=>{
        if (this.form.valid) {
          this.result.setValue(this.form.value)
        }else{
          this.result.setValue('')
        }
        
      })
    ).subscribe()
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

}

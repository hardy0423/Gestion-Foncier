import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SymbologyColorComponent } from './symbology-color.component';

describe('SymbologyColorComponent', () => {
  let component: SymbologyColorComponent;
  let fixture: ComponentFixture<SymbologyColorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SymbologyColorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SymbologyColorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

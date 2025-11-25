import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareNumberComponent } from './compare-number.component';

describe('CompareNumberComponent', () => {
  let component: CompareNumberComponent;
  let fixture: ComponentFixture<CompareNumberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CompareNumberComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompareNumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

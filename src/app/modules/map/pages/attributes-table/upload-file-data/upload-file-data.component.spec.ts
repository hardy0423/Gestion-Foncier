import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadFileDataComponent } from './upload-file-data.component';

describe('UploadFileDataComponent', () => {
  let component: UploadFileDataComponent;
  let fixture: ComponentFixture<UploadFileDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UploadFileDataComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadFileDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

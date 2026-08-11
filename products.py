import uuid
from django.db import models
from authentication.models import Registartion
from common.base_model import CreateModel

class Product(CreateModel):
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name='product')
    ref = models.CharField(max_length=20, unique=True, editable=False) 
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)
    extra_info = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)  

    def save(self, *args, **kwargs):
        if not self.ref:
            # Example: PROD-8CHARUUID
            self.ref = f"PRD-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ref} - {self.name}"
    
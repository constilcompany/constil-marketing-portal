from django.db import models
from common.choices import PaymentsTerms
from common.base_model import CreateModel
from authentication.models import Registartion
from clients.models import Client
from products.models import Product
from django.utils import timezone
from common.choices import TemplateChoices

class Tax(CreateModel):
    user = models.ForeignKey(Registartion,on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    rate = models.PositiveIntegerField(help_text="Tax rate in percentage")

    def __str__(self):
        return f"{self.name} ({self.rate}%)"


class Discount(CreateModel):
    user = models.ForeignKey(Registartion,on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    rate = models.PositiveIntegerField(help_text="Discount rate in percentage")

    def __str__(self):
        return f"{self.name} ({self.rate}%)"

class Invoice(CreateModel):
    invoice_number = models.CharField(max_length=20)
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name="invoices")
    payment_terms = models.SmallIntegerField(choices=PaymentsTerms.choices)
    logo = models.ImageField(upload_to="invoices/logos/", blank=True, null=True)
    invoice_date = models.DateField()
    due_date = models.DateField(help_text="Last date for payment")
    signature = models.ImageField(upload_to="invoices/signature/", blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ✅ New field added for Template Lock
    template_number = models.SmallIntegerField(
        choices=TemplateChoices.choices,
        blank=True,
        null=True,
        help_text="Assigned template number for this invoice (locked after selection)"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "invoice_number"], name="unique_user_invoice_number")
        ]

    def __str__(self):
        return f"Invoice {self.user.name}"

    def calculate_total(self):
        total = sum([
            item.price
            #(item.price * item.quantity)
            for item in self.items.all()
        ])
        self.total_amount = total
        self.save()


class InvoiceItem(CreateModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="invoices")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="invoice_items")
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # store price at invoice time
    description = models.TextField(blank=True, null=True)
    discount_key = models.BooleanField(default=False)
    tax_key = models.BooleanField(default=False)
    tax = models.ManyToManyField(Tax, blank=True, related_name="invoice_items")
    discount = models.ManyToManyField(Discount, blank=True, related_name="invoice_items")

    def __str__(self):
        return f"{self.product.name} x {self.quantity} (Invoice {self.invoice.invoice_number})"

class InvoicePDF(CreateModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='generated_pdf')
    pdf_file = models.FileField(upload_to='invoices/pdfs/')
    generated_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"PDF for {self.invoice.invoice_number}"


class InvoiceMail(CreateModel):
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name="mail")
    clients = models.ManyToManyField(Client, related_name="client_mail")
    file = models.TextField()
    copy = models.BooleanField(default=False)

    def __str__(self):
        return f" name : {self.user.name}"
    

class InvoiceTemplateLock(CreateModel):
    """
    This model locks a template for a specific invoice
    once the user has selected it during invoice creation.
    """
    user = models.ForeignKey(
        Registartion,
        on_delete=models.CASCADE,
        related_name="template_locks"
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="template_lock"
    )
    template_number = models.SmallIntegerField(
        choices=TemplateChoices.choices,
        help_text="Assigned template number for this invoice"
    )
    locked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "invoice"], name="unique_user_invoice_template")
        ]

    def __str__(self):
        return f"Invoice {self.invoice.invoice_number} → Template #{self.template_number}"



class AIInvoice(CreateModel):
    user = models.ForeignKey(Registartion,on_delete=models.CASCADE,related_name="ai_invoice")
    name = models.CharField(max_length=100)
    address = models.TextField()
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    description = models.TextField()
    input_pdf = models.FileField(upload_to="invoice/input_pdfs/",blank=True,null=True)
    output_pdf = models.FileField(upload_to="invoice/output_pdfs/",blank=True,null=True)
    output_json = models.JSONField(blank=True,null=True)
    output_markdown = models.TextField(blank=True,null=True)

    def __str__(self):
        return f"AIInvoice - {self.name}"
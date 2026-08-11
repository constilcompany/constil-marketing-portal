from django.db import models
from common.choices import PaymentsTerms
from common.base_model import CreateModel
from authentication.models import Registartion
from clients.models import Client
from products.models import Product
from invoices.models import Tax,Discount
from common.choices import TemplateChoices


class Estimates(CreateModel):
    estimate_number = models.CharField(max_length=20)
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name="estimates")
    payment_terms = models.SmallIntegerField(choices=PaymentsTerms.choices)
    logo = models.ImageField(upload_to="estimates/logos/", blank=True, null=True)
    estimate_date = models.DateField()  # agar user na de to aaj ki date
    due_date = models.DateField(help_text="Last date for payment")
    signature = models.ImageField(upload_to="estimates/signature/", blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ✅ New field for locking template
    template_number = models.SmallIntegerField(
        choices=TemplateChoices.choices,
        help_text="Assigned template number for this estimate",
        null=True,
        blank=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'estimate_number'],
                name='unique_user_estimate_number'
            )
        ]

    def __str__(self):
        return f"estimates {self.user.name}"

    def calculate_total(self):
        total = sum([
            item.price
            #(item.price * item.quantity)
            for item in self.items.all()
        ])
        self.total_amount = total
        self.save()


class EstimatesItem(CreateModel):
    estimate = models.ForeignKey(Estimates, on_delete=models.CASCADE, related_name="items")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="Estimates")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="estimates_items")
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    discount_key = models.BooleanField(default=False)
    tax_key = models.BooleanField(default=False)
    tax = models.ManyToManyField(Tax, blank=True, related_name="estimate_items")  
    discount = models.ManyToManyField(Discount, blank=True, related_name="estimate_items")

    def __str__(self):
        return f"{self.product.name} x {self.quantity} (Estimates {self.estimate.estimate_number})"
    
class EstimateMail(CreateModel):
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name="Estimate_mail")
    clients = models.ManyToManyField(Client, related_name="client_Estimate")
    file = models.TextField()
    copy = models.BooleanField(default=False)

    def __str__(self):
        return f" name : {self.user.name}"
    
class EstimatePDF(CreateModel):
    estimate = models.ForeignKey(Estimates, on_delete=models.CASCADE, related_name='generated_pdf')
    pdf_file = models.FileField(upload_to='estimate/pdfs/')
    generated_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"PDF for {self.estimate.estimate_number}"

class EstimateTemplateLock(CreateModel):
    """
    This model locks a template for a specific estimate
    once the user has selected it during estimate creation.
    """
    user = models.ForeignKey(
        Registartion,
        on_delete=models.CASCADE,
        related_name="estimate_template_locks"
    )
    estimate = models.ForeignKey(
        Estimates,
        on_delete=models.CASCADE,
        related_name="template_lock"
    )
    template_number = models.SmallIntegerField(
        choices=TemplateChoices.choices,
        help_text="Assigned template number for this estimate"
    )
    locked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "estimate"], name="unique_user_estimate_template")
        ]

    def __str__(self):
        return f"Estimate {self.estimate.estimate_number} → Template #{self.template_number}"


class AIEstimate(CreateModel):
    user = models.ForeignKey(Registartion,on_delete=models.CASCADE,related_name="ai_estimates")
    name = models.CharField(max_length=100)
    address = models.TextField()
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    description = models.TextField(blank=True,null=True)
    input_pdf = models.FileField(upload_to="estimates/input_pdfs/",blank=True,null=True)
    
    def __str__(self):
        return f"{self.user.name}"
    
class AIEstimateResult(CreateModel):
    estimate = models.ForeignKey(AIEstimate, on_delete=models.CASCADE, related_name="results")
    page_number = models.IntegerField(help_text="The page number from the original PDF")
    extracted_page_pdf = models.FileField(upload_to="estimates/extracted_pages/", blank=True, null=True)
    output_pdf = models.FileField(upload_to="estimates/output_pdfs/", blank=True, null=True)
    output_json = models.JSONField(blank=True, null=True)
    output_markdown = models.TextField(blank=True, null=True)
    STATUS_CHOICES = [
        (1, 'Pending'),
        (2, 'Processing'),
        (3, 'Completed'),
        (4, 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    credits_deducted = models.IntegerField(default=0)
    error_log = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.estimate.user.name}"

class AIEstimateChatBot(CreateModel):
    estimate_pages = models.ForeignKey(AIEstimateResult, on_delete=models.CASCADE, related_name="results")
    query = models.TextField()
    response = models.JSONField(default={})

    def __str__(self):
        return f"{self.estimate_pages.estimate.name}"
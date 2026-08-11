from django.db import models
from common.base_model import CreateModel
from django.utils import timezone
from authentication.models import Registartion
from dateutil.relativedelta import relativedelta
from common.choices import(PlanChoices,PackageChoices)

class Client(CreateModel):
    user = models.ForeignKey(Registartion,on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    address = models.TextField()
    email = models.EmailField()
    phone = models.CharField(max_length=15)
    observation = models.TextField(blank=True,null=True)

    def __str__(self):
        return f"Name {self.name} address {self.address} email {self.email}"
    
    class Meta:
        unique_together = ('user', 'email')
    

class SubscriptionPlan(CreateModel):
    name = models.SmallIntegerField(choices=PlanChoices.choices)
    billing_cycle = models.SmallIntegerField(choices=PackageChoices.choices,default=PackageChoices.MONTHLY,)
    price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default="usd") 
    recommended = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    invoice_limit = models.IntegerField(default=0, help_text="0 means unlimited")
    estimate_limit = models.IntegerField(default=0, help_text="0 means unlimited")
    client_limit = models.IntegerField(default=0, help_text="0 means unlimited")
    product_limit = models.IntegerField(default=0, help_text="0 means unlimited")
    mail_limit = models.IntegerField(default=0, help_text="0 means unlimited")
    blue_print_limit = models.IntegerField(default=0,help_text="0 means unlimited") 
    basic_templates = models.BooleanField(default=False)
    professional_templates = models.BooleanField(default=False)
    enterprise_templates = models.BooleanField(default=False)
    stripe_price_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Stripe Price ID for subscription plan"
    )

    def __str__(self):
        return f"{self.get_name_display()} - {self.get_billing_cycle_display()} - ${self.price}"




class UserSubscription(CreateModel):
    user = models.ForeignKey(Registartion, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    # Stripe tracking
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Start date set if missing
        if not self.start_date:
            self.start_date = timezone.now()

        # End date calculate based on plan
        if self.plan:
            if self.plan.billing_cycle == PackageChoices.MONTHLY:
                # if not self.end_date:  # overwrite na ho har save pe
                #     self.end_date = self.start_date + relativedelta(months=1)
                self.end_date = self.start_date + relativedelta(months=1)
            elif self.plan.billing_cycle == PackageChoices.YEARLY:
                # if not self.end_date:
                #     self.end_date = self.start_date + relativedelta(years=1)
                self.end_date = self.start_date + relativedelta(years=1)

        super().save(*args, **kwargs)

        # Wallet update only when active
        # if self.is_active and self.plan:
        #     wallet, _ = Wallet.objects.get_or_create(user=self.user)
        #     wallet.update_from_plan(self.plan)
        # self.is_active = False
        # self.save(update_fields=["is_active"])

    # Utility methods
    def has_active_subscription(self):
        """Check if user has a valid active subscription"""
        return self.is_active and self.end_date and self.end_date > timezone.now()

    def is_free_trial(self):
        """Check if user is on free trial"""
        return self.plan and self.plan.name == PlanChoices.FREE

    def __str__(self):
        return f"{self.user.email} - {self.plan.name if self.plan else 'No Plan'} | {self.start_date.strftime('%Y-%m-%d')} ({'Active' if self.is_active else 'Inactive'})"






class Wallet(CreateModel):
    user = models.OneToOneField(Registartion, on_delete=models.CASCADE, related_name="wallet")
    invoice = models.IntegerField(default=0)
    estimate = models.IntegerField(default=0)
    client = models.IntegerField(default=0)
    product = models.IntegerField(default=0)
    blue_print = models.IntegerField(default=0)
    basic_templates = models.BooleanField(default=False)
    professional_templates = models.BooleanField(default=False)
    enterprise_templates = models.BooleanField(default=False)

    def update_from_plan(self, plan: SubscriptionPlan):
        """Update wallet limits and features based on subscription plan"""
        if plan.invoice_limit:
            self.invoice += plan.invoice_limit
        if plan.estimate_limit:
            self.estimate += plan.estimate_limit
        if plan.client_limit:
            self.client += plan.client_limit
        if plan.product_limit:
            self.product += plan.product_limit
        if plan.blue_print_limit:
            self.blue_print += plan.blue_print_limit

        self.basic_templates = plan.basic_templates or self.basic_templates
        self.professional_templates = plan.professional_templates or self.professional_templates
        self.enterprise_templates = plan.enterprise_templates or self.enterprise_templates

        self.save()

    def deduct_from_plan(self, plan: SubscriptionPlan):
        """Wallet se plan ke hisaab se minus kare (on expiry)"""
        if plan.invoice_limit:
            self.invoice = max(0, self.invoice - plan.invoice_limit)
        if plan.estimate_limit:
            self.estimate = max(0, self.estimate - plan.estimate_limit)
        if plan.client_limit:
            self.client = max(0, self.client - plan.client_limit)
        if plan.product_limit:
            self.product = max(0, self.product - plan.product_limit)
        if plan.blue_print_limit:
            self.blue_print = max(0, self.blue_print - plan.blue_print_limit)


        self.save()


from django.db import models

class UserRole(models.IntegerChoices):
    SUPER_ADMIN = 0, 'SUPER_ADMIN'        
    USER = 1, 'USER'               

class PackageChoices(models.IntegerChoices):
    MONTHLY = 0, 'MONTHLY'
    YEARLY = 1, 'YEARLY'                     

class SubscriptionStatusChoices(models.IntegerChoices):
    TRIALING = 0, 'TRIALING'
    ACTIVE = 1, 'ACTIVE'
    EXPIRED = 2, 'EXPIRED'
    CANCELED = 3, 'CANCELED'
    UNPAID = 4, 'UNPAID'                          

class PaymentsTerms(models.IntegerChoices):
    DUEONRECEIPT = 0,'DUEONRECEIPT'
    TENDAYS = 1 , 'TENDAYS'
    FIFTEENDAYS = 2 , 'FIFTEENDAYS'
    THIRTYDAYS = 3 , 'THIRTYDAYS'
    FOURTYFIVEDAYS = 4 , 'FOURTYFIVEDAYS'
    SIXTYDAYS = 5 , 'SIXTYDAYS'
    NINTYDAYS = 6 , 'NINTYDAYS'

class PlanChoices(models.IntegerChoices):
    FREE = 1, 'FREE TRIAL'
    BASIC_PLAN = 2, 'BASIC_PLAN'
    PROFESSIONAL = 3, 'PROFESSIONAL'
    ENTERPRISE = 4, 'ENTERPRISE'

class TemplateChoices(models.IntegerChoices):
    ONE = 1, 'ONE'
    TWO = 2, 'TWO'
    THREE = 3, 'THREE'
    FOUR = 4, 'FOUR'
    FIVE = 5, 'FIVE'
    SIX = 6, 'SIX'
    SEVEN = 7, 'SEVEN'
    EIGHT = 8, 'EIGHT'

class BusinessTypeChoices(models.IntegerChoices):
    NOT_SURE = 1, 'Not sure'
    OTHER = 2, 'Other'
    NONE = 3, 'None'